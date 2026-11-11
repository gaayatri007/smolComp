import asyncio
import logging
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
import requests
import stripe
from dotenv import load_dotenv
from stripe import StripeClient
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ASCENDING, DESCENDING, IndexModel

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('smolcomp')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '').strip()
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '').strip()
APP_NAME = 'smolcomp'

STORAGE_BASE = (os.environ.get('INTEGRATION_PROXY_URL') or '').strip() or 'https://integrations.emergentagent.com'
STORAGE_URL = STORAGE_BASE.rstrip('/') + '/objstore/api/v1/storage'
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    if not EMERGENT_KEY:
        raise RuntimeError('EMERGENT_LLM_KEY is required for the object-storage integration')
    resp = requests.post(f'{STORAGE_URL}/init', json={'emergent_key': EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()['storage_key']
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f'{STORAGE_URL}/objects/{path}',
        headers={'X-Storage-Key': key, 'Content-Type': content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f'{STORAGE_URL}/objects/{path}', headers={'X-Storage-Key': key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get('Content-Type', 'application/octet-stream')


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {'sub': user_id, 'email': email, 'exp': datetime.now(timezone.utc) + timedelta(minutes=15), 'type': 'access'}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {'sub': user_id, 'exp': datetime.now(timezone.utc) + timedelta(days=7), 'type': 'refresh'}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, email: str):
    response.set_cookie(key='access_token', value=create_access_token(user_id, email), httponly=True, secure=True, samesite='none', max_age=900, path='/')
    response.set_cookie(key='refresh_token', value=create_refresh_token(user_id), httponly=True, secure=True, samesite='none', max_age=604800, path='/')


def now_utc():
    return datetime.now(timezone.utc)


def out(doc):
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop('_id', None)
    doc.pop('password_hash', None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


def out_many(docs):
    return [out(d) for d in docs]


def public_artwork(a):
    """Secret pieces never leak their image or price to the public catalog."""
    a = out(a)
    if a and a.get('rarity') == 'secret':
        a['image'] = ''
        a['price'] = None
        a['artist_bio'] = ''
    return a


def slugify(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user = await db.users.find_one({'_id': payload['sub']})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')
    return user


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get('role') not in roles:
            raise HTTPException(status_code=403, detail='Not allowed for your role')
        return user
    return dep


def build_stripe() -> StripeClient:
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail='Checkout is not configured')
    return StripeClient(STRIPE_API_KEY)


app = FastAPI(title='smolComp API')

cors_origins = os.environ.get('CORS_ORIGINS') or 'http://localhost:3000'
allowed_origins = [origin.strip().rstrip('/') for origin in cors_origins.split(',') if origin.strip()]
if not allowed_origins or '*' in allowed_origins:
    raise ValueError('CORS_ORIGINS must contain explicit origins; wildcard origins are not allowed with credentials')
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

api_router = APIRouter(prefix='/api')


# ---------------- Auth ----------------

class RegisterIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    name: str = Field(min_length=1, max_length=120)
    email: str
    password: str = Field(min_length=6, max_length=128)
    role: str = 'customer'
    craft: str = ''
    region: str = ''
    bio: str = ''


class LoginIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    email: str
    password: str
    role: str = ''


@api_router.get('/')
async def root():
    return {'message': 'smolComp API online', 'season': 'kutch-resonance'}


@api_router.post('/auth/register')
async def register(input: RegisterIn, response: Response):
    email = input.email.strip().lower()
    role = input.role if input.role in ('customer', 'artist') else 'customer'
    if await db.users.find_one({'email': email}):
        raise HTTPException(status_code=400, detail='An account with this email already exists')
    user = {
        '_id': str(uuid.uuid4()),
        'id': str(uuid.uuid4()),
        'email': email,
        'password_hash': hash_password(input.password),
        'name': input.name.strip(),
        'role': role,
        'status': 'approved' if role == 'customer' else 'pending',
        'craft': input.craft.strip(),
        'region': input.region.strip(),
        'bio': input.bio.strip(),
        'created_at': now_utc(),
    }
    await db.users.insert_one(user)
    set_auth_cookies(response, user['_id'], email)
    return out(user)


@api_router.post('/auth/login')
async def login(input: LoginIn, request: Request, response: Response):
    email = input.email.strip().lower()
    ip = request.client.host if request.client else 'unknown'
    identifier = f'{ip}:{email}'
    attempt = await db.login_attempts.find_one({'identifier': identifier})
    if attempt and attempt.get('locked_until') and attempt['locked_until'] > now_utc():
        raise HTTPException(status_code=423, detail='Too many failed attempts. Try again in 15 minutes.')
    user = await db.users.find_one({'email': email})
    if not user or not verify_password(input.password, user.get('password_hash', '')):
        await db.login_attempts.update_one(
            {'identifier': identifier},
            {'$inc': {'count': 1}, '$set': {'updated_at': now_utc(),
             'locked_until': now_utc() + timedelta(minutes=15) if attempt and attempt.get('count', 0) + 1 >= 5 else None}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail='Invalid email or password')
    if input.role and input.role != user.get('role'):
        pretty = {'customer': 'Customer', 'artist': 'Artist', 'admin': 'Admin'}.get(user.get('role'), user.get('role'))
        raise HTTPException(status_code=403, detail=f"This account belongs to the {pretty} portal — use the {pretty} entrance")
    if user.get('role') == 'artist' and user.get('status') != 'approved':
        raise HTTPException(status_code=403, detail='Your studio application is still awaiting curation. You will hear from us soon.')
    await db.login_attempts.delete_one({'identifier': identifier})
    set_auth_cookies(response, user['_id'], email)
    return out(user)


@api_router.post('/auth/logout')
async def logout(response: Response):
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'ok': True}


@api_router.get('/auth/me')
async def me(user: dict = Depends(get_current_user)):
    return out(user)


@api_router.post('/auth/refresh')
async def refresh(request: Request, response: Response):
    token = request.cookies.get('refresh_token')
    if not token:
        raise HTTPException(status_code=401, detail='No refresh token')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user = await db.users.find_one({'_id': payload['sub']})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Refresh token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')
    set_auth_cookies(response, user['_id'], user['email'])
    return {'ok': True}


# ---------------- Catalog ----------------

@api_router.get('/seasons')
async def get_seasons():
    seasons = await db.seasons.find().to_list(50)
    seasons.sort(key=lambda s: s.get('number', 0), reverse=True)
    order = {'live': 0, 'upcoming': 1, 'past': 2}
    seasons.sort(key=lambda s: order.get(s.get('status'), 3))
    return out_many(seasons)


@api_router.get('/seasons/{slug}')
async def get_season(slug: str):
    season = await db.seasons.find_one({'slug': slug})
    if not season:
        raise HTTPException(status_code=404, detail='Season not found')
    series = await db.series.find({'season_slug': slug}).to_list(50)
    return {'season': out(season), 'series': out_many(series)}


@api_router.get('/series')
async def get_series(season: str = '', kind: str = ''):
    q = {}
    if season:
        q['season_slug'] = season
    if kind:
        q['kind'] = kind
    docs = await db.series.find(q).to_list(50)
    return out_many(docs)


@api_router.get('/artworks')
async def get_artworks(series: str = '', season: str = '', timeless: str = '', rarity: str = ''):
    q = {}
    if series:
        q['series_slug'] = series
    if season:
        q['season_slug'] = season
    if timeless in ('true', '1'):
        q['timeless'] = True
    if rarity:
        q['rarity'] = rarity
    docs = await db.artworks.find(q).to_list(300)
    return [public_artwork(a) for a in docs]


@api_router.get('/boxes')
async def get_boxes(series: str = ''):
    q = {}
    if series:
        q['series_slug'] = series
    docs = await db.blind_boxes.find(q).to_list(50)
    return out_many([b for b in docs if b.get('active', True)])


@api_router.get('/vault')
async def get_vault():
    secrets = await db.artworks.find({'rarity': 'secret'}).to_list(100)
    found = await db.revelations.count_documents({'rarity': 'secret'})
    return {'secrets': [public_artwork(s) for s in secrets], 'secrets_found_by_collectors': found}


# ---------------- Polls ----------------

class PollIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    question: str
    description: str = ''
    options: List[str]


@api_router.get('/polls')
async def get_polls(request: Request):
    user = None
    try:
        user = await get_current_user(request)
    except HTTPException:
        pass
    polls = await db.polls.find({'active': True}).to_list(50)
    result = []
    for p in polls:
        counts = {}
        async for v in db.votes.find({'poll_id': p['_id']}):
            counts[v['option_id']] = counts.get(v['option_id'], 0) + 1
        options = [{'id': o['id'], 'label': o['label'], 'votes': counts.get(o['id'], 0)} for o in p.get('options', [])]
        my_vote = None
        if user:
            v = await db.votes.find_one({'poll_id': p['_id'], 'user_id': user['_id']})
            my_vote = v['option_id'] if v else None
        result.append(out({**p, 'id': p['_id'], 'options': options, 'my_vote': my_vote}))
    return result


class VoteIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    option_id: str


@api_router.post('/polls/{poll_id}/vote')
async def vote(poll_id: str, input: VoteIn, user: dict = Depends(get_current_user)):
    poll = await db.polls.find_one({'_id': poll_id})
    if not poll or not poll.get('active'):
        raise HTTPException(status_code=404, detail='Poll not found or closed')
    if not any(o['id'] == input.option_id for o in poll.get('options', [])):
        raise HTTPException(status_code=400, detail='Invalid option')
    existing = await db.votes.find_one({'poll_id': poll_id, 'user_id': user['_id']})
    if existing:
        raise HTTPException(status_code=409, detail='You have already voted on this poll')
    await db.votes.insert_one({'_id': str(uuid.uuid4()), 'poll_id': poll_id, 'user_id': user['_id'], 'option_id': input.option_id, 'created_at': now_utc()})
    return {'ok': True}


# ---------------- Payments (Stripe shared test sandbox, Flow B) ----------------

class CheckoutIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    box_id: str = ''
    artwork_id: str = ''
    quantity: int = Field(default=1, ge=1, le=10)
    origin_url: str


@api_router.post('/payments/checkout')
async def checkout(input: CheckoutIn, user: dict = Depends(get_current_user)):
    metadata = {'user_id': user['_id'], 'quantity': str(input.quantity)}
    if input.box_id:
        box = await db.blind_boxes.find_one({'id': input.box_id})
        if not box or not box.get('active', True):
            raise HTTPException(status_code=404, detail='Blind box not found')
        amount = float(box['price']) * input.quantity
        metadata.update({'kind': 'box', 'box_id': box['id']})
        label = box.get('name', 'Blind Box')
    elif input.artwork_id:
        artwork = await db.artworks.find_one({'id': input.artwork_id})
        if not artwork or artwork.get('status') == 'sold_out' or not artwork.get('price'):
            raise HTTPException(status_code=404, detail='Artwork not available')
        amount = float(artwork['price'])
        input.quantity = 1
        metadata.update({'kind': 'artwork', 'artwork_id': artwork['id']})
        label = artwork.get('title', 'Artwork')
    else:
        raise HTTPException(status_code=400, detail='Nothing to purchase')
    origin = input.origin_url.rstrip('/')
    try:
        session = await asyncio.to_thread(
            build_stripe().v1.checkout.sessions.create,
            {
                'mode': 'payment',
                'line_items': [{
                    'price_data': {
                        'currency': 'usd',
                        'unit_amount': int(round(amount * 100)),
                        'product_data': {'name': label},
                    },
                    'quantity': input.quantity,
                }],
                'success_url': f'{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}',
                'cancel_url': f'{origin}/payment/cancel',
                'metadata': metadata,
            },
        )
    except stripe.StripeError as exc:
        logger.warning('Stripe checkout session creation failed: %s', exc)
        raise HTTPException(status_code=502, detail='Unable to start checkout') from exc
    await db.payment_transactions.insert_one({
        '_id': str(uuid.uuid4()),
        'session_id': session.id,
        'user_id': user['_id'],
        'user_name': user.get('name', ''),
        'kind': metadata['kind'],
        'item_id': metadata.get('box_id') or metadata.get('artwork_id', ''),
        'item_label': label,
        'quantity': input.quantity,
        'amount': amount,
        'currency': 'usd',
        'status': 'initiated',
        'payment_status': 'pending',
        'fulfilled': False,
        'created_at': now_utc(),
        'updated_at': now_utc(),
    })
    return {'checkout_url': session.url, 'session_id': session.id}


def roll_artwork(box: dict, artworks: List[dict]) -> Optional[dict]:
    weights = {
        'common': box.get('weight_common', 60),
        'rare': box.get('weight_rare', 30),
        'secret': box.get('weight_secret', 10),
    }
    rarity = random.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0]
    pool = [a for a in artworks if a.get('rarity', 'common') == rarity]
    if not pool:
        pool = [a for a in artworks if a.get('rarity', 'common') == 'common'] or artworks
    return random.choice(pool) if pool else None


async def fulfill_transaction(session_id: str):
    claimed = await db.payment_transactions.find_one_and_update(
        {'session_id': session_id, 'fulfilled': {'$ne': True}},
        {'$set': {'fulfilled': True, 'status': 'completed', 'updated_at': now_utc()}},
    )
    if not claimed:
        return
    if claimed['kind'] == 'box':
        box = await db.blind_boxes.find_one({'id': claimed['item_id']})
        if not box:
            return
        artworks = await db.artworks.find({'series_slug': box['series_slug'], 'for_blindbox': True}).to_list(200)
        for _ in range(int(claimed.get('quantity') or 1)):
            artwork = roll_artwork(box, artworks)
            if artwork:
                await db.revelations.insert_one({
                    '_id': str(uuid.uuid4()),
                    'session_id': session_id,
                    'user_id': claimed['user_id'],
                    'box_id': box['id'],
                    'box_name': box.get('name', ''),
                    'series_slug': box['series_slug'],
                    'artwork_id': artwork['id'],
                    'rarity': artwork.get('rarity', 'common'),
                    'opened': False,
                    'created_at': now_utc(),
                })
    elif claimed['kind'] == 'artwork':
        await db.artworks.update_one({'id': claimed['item_id']}, {'$set': {'status': 'sold_out'}})
        await db.purchases.insert_one({
            '_id': str(uuid.uuid4()),
            'session_id': session_id,
            'user_id': claimed['user_id'],
            'artwork_id': claimed['item_id'],
            'created_at': now_utc(),
        })


@api_router.get('/payments/status/{session_id}')
async def payment_status(session_id: str):
    rec = await db.payment_transactions.find_one({'session_id': session_id})
    if not rec:
        raise HTTPException(status_code=404, detail='Transaction not found')
    if rec['payment_status'] != 'paid' and STRIPE_API_KEY:
        try:
            st = await asyncio.to_thread(
                build_stripe().v1.checkout.sessions.retrieve,
                session_id,
            )
            if st.payment_status == 'paid':
                await db.payment_transactions.update_one(
                    {'session_id': session_id, 'payment_status': {'$ne': 'paid'}},
                    {'$set': {'status': 'completed', 'payment_status': 'paid', 'updated_at': now_utc()}},
                )
                rec = await db.payment_transactions.find_one({'session_id': session_id})
        except stripe.StripeError as exc:
            logger.warning('Stripe payment status lookup failed for session %s: %s', session_id, exc)
    revealed = []
    if rec['payment_status'] == 'paid':
        await fulfill_transaction(session_id)
        revs = await db.revelations.find({'session_id': session_id}).to_list(20)
        for r in revs:
            artwork = await db.artworks.find_one({'id': r['artwork_id']})
            if artwork:
                revealed.append({'revelation_id': r['_id'], 'artwork': out(artwork), 'rarity': r['rarity']})
    return {
        'session_id': session_id,
        'status': rec['status'],
        'payment_status': rec['payment_status'],
        'kind': rec['kind'],
        'item_label': rec.get('item_label', ''),
        'revealed': revealed,
    }


@api_router.post('/webhook/stripe')
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail='Stripe webhook is not configured')
    body = await request.body()
    sig = request.headers.get('stripe-signature', '')
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail='Invalid webhook payload or signature') from exc
    if event['type'] not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded'):
        return {'status': 'ignored'}
    session = event['data']['object']
    if session.get('payment_status') != 'paid':
        return {'status': 'ignored'}
    session_id = session.get('id')
    if not session_id:
        raise HTTPException(status_code=400, detail='Checkout session ID is missing')
    await db.payment_transactions.update_one(
        {'session_id': session_id, 'payment_status': {'$ne': 'paid'}},
        {'$set': {'status': 'completed', 'payment_status': 'paid', 'updated_at': now_utc()}},
    )
    rec = await db.payment_transactions.find_one({'session_id': session_id})
    if rec and rec.get('payment_status') == 'paid':
        await fulfill_transaction(session_id)
    return {'status': 'ok'}


# ---------------- Customer space ----------------

@api_router.get('/my/revelations')
async def my_revelations(user: dict = Depends(get_current_user)):
    revs = await db.revelations.find({'user_id': user['_id']}).sort('created_at', DESCENDING).to_list(100)
    result = []
    for r in revs:
        artwork = await db.artworks.find_one({'id': r['artwork_id']})
        result.append({**out(r), 'id': r['_id'], 'artwork': out(artwork) if artwork else None})
    return result


@api_router.post('/my/revelations/{rev_id}/open')
async def open_revelation(rev_id: str, user: dict = Depends(get_current_user)):
    r = await db.revelations.find_one({'_id': rev_id, 'user_id': user['_id']})
    if not r:
        raise HTTPException(status_code=404, detail='Revelation not found')
    await db.revelations.update_one({'_id': rev_id}, {'$set': {'opened': True}})
    return {'ok': True}


@api_router.get('/my/purchases')
async def my_purchases(user: dict = Depends(get_current_user)):
    purchases = await db.purchases.find({'user_id': user['_id']}).sort('created_at', DESCENDING).to_list(100)
    result = []
    for p in purchases:
        artwork = await db.artworks.find_one({'id': p['artwork_id']})
        if artwork:
            result.append({**out(p), 'id': p['_id'], 'artwork': out(artwork)})
    return result


# ---------------- Artist space ----------------

@api_router.post('/artist/submissions')
async def create_submission(
    request: Request,
    title: str = Form(...),
    series_slug: str = Form(...),
    kind: str = Form('craft'),
    description: str = Form(''),
    price: float = Form(0),
    rarity: str = Form('common'),
    image: UploadFile = File(...),
    user: dict = Depends(require_role('artist')),
):
    if user.get('status') != 'approved':
        raise HTTPException(status_code=403, detail='Your studio is awaiting approval')
    ext = (image.filename or 'bin').split('.')[-1].lower() if image.filename else 'bin'
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        ext = 'bin'
    data = await image.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='Image must be under 8MB')
    path = f'{APP_NAME}/uploads/{user["_id"]}/{uuid.uuid4()}.{ext}'
    try:
        result = put_object(path, data, image.content_type or 'application/octet-stream')
        stored_path = result['path']
    except Exception as e:
        logger.error(f'storage upload failed: {e}')
        raise HTTPException(status_code=500, detail='Image upload failed — try again')
    doc = {
        '_id': str(uuid.uuid4()),
        'artist_id': user['_id'],
        'artist_name': user.get('name', ''),
        'artist_craft': user.get('craft', ''),
        'title': title.strip(),
        'series_slug': series_slug,
        'kind': kind,
        'description': description.strip(),
        'price': float(price),
        'rarity': rarity if rarity in ('common', 'rare', 'secret') else 'common',
        'image': stored_path,
        'status': 'pending',
        'created_at': now_utc(),
    }
    await db.submissions.insert_one(doc)
    return out(doc)


@api_router.get('/artist/submissions')
async def my_submissions(user: dict = Depends(require_role('artist'))):
    docs = await db.submissions.find({'artist_id': user['_id']}).sort('created_at', DESCENDING).to_list(100)
    return out_many(docs)


# ---------------- Admin ----------------

@api_router.get('/admin/overview')
async def admin_overview(user: dict = Depends(require_role('admin'))):
    txs = await db.payment_transactions.find({'payment_status': 'paid'}).to_list(1000)
    revenue = sum(float(t.get('amount', 0)) for t in txs)
    return {
        'paid_orders': len(txs),
        'revenue_usd': round(revenue, 2),
        'pending_artists': await db.users.count_documents({'role': 'artist', 'status': 'pending'}),
        'approved_artists': await db.users.count_documents({'role': 'artist', 'status': 'approved'}),
        'pending_submissions': await db.submissions.count_documents({'status': 'pending'}),
        'boxes_opened': await db.revelations.count_documents({}),
        'secrets_found': await db.revelations.count_documents({'rarity': 'secret'}),
        'total_votes': await db.votes.count_documents({}),
        'customers': await db.users.count_documents({'role': 'customer'}),
    }


@api_router.get('/admin/users')
async def admin_users(role: str = '', status: str = '', user: dict = Depends(require_role('admin'))):
    q = {}
    if role:
        q['role'] = role
    if status:
        q['status'] = status
    docs = await db.users.find(q).sort('created_at', DESCENDING).to_list(200)
    return out_many(docs)


class UserStatusIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    status: str


@api_router.post('/admin/users/{user_id}/status')
async def admin_set_user_status(user_id: str, input: UserStatusIn, admin: dict = Depends(require_role('admin'))):
    if input.status not in ('approved', 'rejected', 'pending'):
        raise HTTPException(status_code=400, detail='Invalid status')
    r = await db.users.find_one_and_update(
        {'role': 'artist', '$or': [{'_id': user_id}, {'id': user_id}]},
        {'$set': {'status': input.status}},
    )
    if not r:
        raise HTTPException(status_code=404, detail='Artist not found')
    return {'ok': True}


@api_router.post('/admin/seasons')
async def admin_create_season(input: dict, admin: dict = Depends(require_role('admin'))):
    slug = slugify(input.get('title', ''))
    if not slug or await db.seasons.find_one({'slug': slug}):
        raise HTTPException(status_code=400, detail='Season needs a unique title')
    max_num = await db.seasons.count_documents({})
    doc = {
        '_id': slug,
        'slug': slug,
        'number': int(input.get('number') or max_num),
        'title': input.get('title', ''),
        'region': input.get('region', ''),
        'country': input.get('country', 'India'),
        'description': input.get('description', ''),
        'hero_image': input.get('hero_image', ''),
        'status': input.get('status', 'live'),
        'start_date': input.get('start_date') or now_utc().isoformat(),
        'end_date': input.get('end_date') or (now_utc() + timedelta(days=45)).isoformat(),
        'created_at': now_utc(),
    }
    await db.seasons.insert_one(doc)
    return out(doc)


class PatchIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    status: str


@api_router.patch('/admin/seasons/{slug}/status')
async def admin_set_season_status(slug: str, input: PatchIn, admin: dict = Depends(require_role('admin'))):
    if input.status not in ('live', 'past', 'upcoming'):
        raise HTTPException(status_code=400, detail='Invalid status')
    r = await db.seasons.find_one_and_update({'slug': slug}, {'$set': {'status': input.status}})
    if not r:
        raise HTTPException(status_code=404, detail='Season not found')
    if input.status == 'past':
        await db.blind_boxes.update_many({'series_slug': {'$in': [s['slug'] async for s in db.series.find({'season_slug': slug}, {'slug': 1})]}}, {'$set': {'active': False}})
        await db.artworks.update_many({'season_slug': slug, 'rarity': {'$ne': 'secret'}}, {'$set': {'status': 'sold_out'}})
    return {'ok': True}


@api_router.post('/admin/series')
async def admin_create_series(input: dict, admin: dict = Depends(require_role('admin'))):
    slug = slugify(input.get('title', ''))
    if not slug or await db.series.find_one({'slug': slug}):
        raise HTTPException(status_code=400, detail='Series needs a unique title')
    doc = {
        '_id': slug,
        'slug': slug,
        'season_slug': input.get('season_slug', ''),
        'title': input.get('title', ''),
        'craft': input.get('craft', ''),
        'description': input.get('description', ''),
        'cover_image': input.get('cover_image', ''),
        'kind': input.get('kind', 'seasonal'),
        'status': 'active',
        'created_at': now_utc(),
    }
    await db.series.insert_one(doc)
    return out(doc)


@api_router.post('/admin/artworks')
async def admin_create_artwork(input: dict, admin: dict = Depends(require_role('admin'))):
    if not input.get('title'):
        raise HTTPException(status_code=400, detail='Title required')
    doc = {
        '_id': str(uuid.uuid4()),
        'id': str(uuid.uuid4()),
        'series_slug': input.get('series_slug', ''),
        'season_slug': input.get('season_slug', ''),
        'title': input['title'],
        'kind': input.get('kind', 'craft'),
        'description': input.get('description', ''),
        'image': input.get('image', ''),
        'price': float(input.get('price') or 0),
        'artist_name': input.get('artist_name', ''),
        'artist_bio': input.get('artist_bio', ''),
        'rarity': input.get('rarity', 'common'),
        'for_blindbox': bool(input.get('for_blindbox', True)),
        'timeless': bool(input.get('timeless', False)),
        'hint': input.get('hint', ''),
        'status': 'available',
        'created_at': now_utc(),
    }
    await db.artworks.insert_one(doc)
    return out(doc)


@api_router.post('/admin/boxes')
async def admin_create_box(input: dict, admin: dict = Depends(require_role('admin'))):
    doc = {
        '_id': str(uuid.uuid4()),
        'id': str(uuid.uuid4()),
        'series_slug': input.get('series_slug', ''),
        'name': input.get('name', 'Blind Box'),
        'price': float(input.get('price') or 0),
        'image': input.get('image', ''),
        'weight_common': int(input.get('weight_common', 60)),
        'weight_rare': int(input.get('weight_rare', 30)),
        'weight_secret': int(input.get('weight_secret', 10)),
        'active': True,
        'created_at': now_utc(),
    }
    await db.blind_boxes.insert_one(doc)
    return out(doc)


@api_router.post('/admin/polls')
async def admin_create_poll(input: PollIn, admin: dict = Depends(require_role('admin'))):
    if len(input.options) < 2:
        raise HTTPException(status_code=400, detail='At least two options required')
    doc = {
        '_id': f'poll-{slugify(input.question)}-{str(uuid.uuid4())[:6]}',
        'question': input.question,
        'description': input.description,
        'options': [{'id': slugify(o) or str(uuid.uuid4())[:8], 'label': o, 'votes': 0} for o in input.options],
        'active': True,
        'created_at': now_utc(),
    }
    await db.polls.insert_one(doc)
    return out(doc)


class ActiveIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    active: bool


@api_router.patch('/admin/polls/{poll_id}/active')
async def admin_poll_active(poll_id: str, input: ActiveIn, admin: dict = Depends(require_role('admin'))):
    r = await db.polls.find_one_and_update({'_id': poll_id}, {'$set': {'active': input.active}})
    if not r:
        raise HTTPException(status_code=404, detail='Poll not found')
    return {'ok': True}


@api_router.patch('/admin/boxes/{box_id}/active')
async def admin_box_active(box_id: str, input: ActiveIn, admin: dict = Depends(require_role('admin'))):
    r = await db.blind_boxes.find_one_and_update({'id': box_id}, {'$set': {'active': input.active}})
    if not r:
        raise HTTPException(status_code=404, detail='Box not found')
    return {'ok': True}


@api_router.get('/admin/orders')
async def admin_orders(admin: dict = Depends(require_role('admin'))):
    txs = await db.payment_transactions.find().sort('created_at', DESCENDING).to_list(200)
    result = []
    for t in txs:
        o = out(t)
        o['revealed'] = await db.revelations.count_documents({'session_id': t['session_id']})
        result.append(o)
    return result


@api_router.get('/admin/submissions')
async def admin_submissions(status: str = '', admin: dict = Depends(require_role('admin'))):
    q = {'status': status} if status else {}
    docs = await db.submissions.find(q).sort('created_at', DESCENDING).to_list(200)
    return [{**out(doc), 'id': doc['_id']} for doc in docs]


class DecisionIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    status: str
    series_slug: str = ''


@api_router.post('/admin/submissions/{sub_id}/decision')
async def admin_decide_submission(sub_id: str, input: DecisionIn, admin: dict = Depends(require_role('admin'))):
    sub = await db.submissions.find_one({'_id': sub_id})
    if not sub:
        raise HTTPException(status_code=404, detail='Submission not found')
    if input.status not in ('approved', 'rejected'):
        raise HTTPException(status_code=400, detail='Invalid decision')
    if input.status == 'approved':
        if not input.series_slug:
            raise HTTPException(status_code=400, detail='Pick a series to place this artwork in')
        series = await db.series.find_one({'slug': input.series_slug})
        artwork = {
            '_id': str(uuid.uuid4()),
            'id': str(uuid.uuid4()),
            'series_slug': input.series_slug,
            'season_slug': series['season_slug'] if series else '',
            'title': sub['title'],
            'kind': sub.get('kind', 'craft'),
            'description': sub.get('description', ''),
            'image': sub.get('image', ''),
            'price': float(sub.get('price') or 0),
            'artist_name': sub.get('artist_name', ''),
            'artist_bio': sub.get('artist_craft', ''),
            'rarity': sub.get('rarity', 'common'),
            'for_blindbox': True,
            'timeless': False,
            'hint': '',
            'status': 'available',
            'created_at': now_utc(),
        }
        await db.artworks.insert_one(artwork)
    await db.submissions.update_one({'_id': sub_id}, {'$set': {'status': input.status, 'series_slug': input.series_slug or sub.get('series_slug', '')}})
    return {'ok': True}


@api_router.post('/admin/upload')
async def admin_upload(image: UploadFile = File(...), admin: dict = Depends(require_role('admin'))):
    ext = (image.filename or 'bin').split('.')[-1].lower() if image.filename else 'bin'
    if ext not in ('jpg', 'jpeg', 'png', 'webp'):
        raise HTTPException(status_code=400, detail='Only jpg, png, webp images')
    data = await image.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='Image must be under 8MB')
    path = f'{APP_NAME}/uploads/admin/{uuid.uuid4()}.{ext}'
    result = put_object(path, data, image.content_type or 'application/octet-stream')
    return {'path': result['path'], 'url': f'/api/files/{result["path"]}'}


# ---------------- Files (public catalog media) ----------------

@api_router.get('/files/{path:path}')
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail='File not found')
    return Response(content=data, media_type=content_type, headers={'Cache-Control': 'public, max-age=86400'})


INDEXES = {
    'users': [IndexModel([('email', ASCENDING)], name='email_unique', unique=True)],
    'votes': [IndexModel([('poll_id', ASCENDING), ('user_id', ASCENDING)], name='poll_user_unique', unique=True)],
    'payment_transactions': [IndexModel([('session_id', ASCENDING)], name='session_unique', unique=True)],
    'revelations': [IndexModel([('session_id', ASCENDING)], name='session_idx')],
    'login_attempts': [IndexModel([('identifier', ASCENDING)], name='identifier_idx')],
}


async def ensure_indexes():
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error('ensure_indexes(%s): %s', collection, exc)


async def seed_admin():
    admin_email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_email or not admin_password:
        logger.warning('Admin account not seeded; set ADMIN_EMAIL and ADMIN_PASSWORD')
        return

    existing = await db.users.find_one({'email': admin_email})
    if existing is None:
        await db.users.insert_one({
            '_id': str(uuid.uuid4()),
            'id': str(uuid.uuid4()),
            'email': admin_email,
            'password_hash': hash_password(admin_password),
            'name': 'Platform Admin',
            'role': 'admin',
            'status': 'approved',
            'craft': '',
            'region': '',
            'bio': '',
            'created_at': now_utc(),
        })
        logger.info('Admin seeded: %s', admin_email)


app.include_router(api_router)


@app.on_event('startup')
async def startup():
    asyncio.create_task(ensure_indexes())
    try:
        await seed_admin()
    except Exception as e:
        logger.error('admin seed failed: %s', e)
    if EMERGENT_KEY:
        try:
            init_storage()
            logger.info('Object storage initialized')
        except Exception as e:
            logger.error('Storage init failed: %s', e)
    else:
        logger.info('Object storage initialization skipped; EMERGENT_LLM_KEY is not configured')


@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
