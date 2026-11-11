# smolComp

smolComp is a React single-page application with a FastAPI API and MongoDB storage. The API also supports Stripe payments and an optional object-storage integration.

## Deployment readiness

The original frontend page files were absent from this copy, so the frontend has been reconstructed from the routes in `frontend/src/App.js`, `design_guidelines.json`, and the FastAPI endpoints. The reconstructed pages call the backend, but they are not a verified recovery of the original UI. The production frontend build has been verified; the complete checkout/authentication flow still needs testing against configured MongoDB and Stripe services.

The project also needs deployment-specific settings and external services: a MongoDB database, a Stripe API key, and secure admin credentials. Do not commit credentials or put backend secrets in frontend variables.

## Deploy from VS Code

The included deployment setup uses GitHub as the source, Render for the FastAPI backend, MongoDB Atlas for the database, and Vercel for the React frontend. You can manage the source and GitHub publishing from VS Code; Render and Vercel perform the actual hosted builds and deployments after you connect the repository.

### 1. Review and publish the project to GitHub

1. Open the project folder in VS Code and inspect the reconstructed pages under `frontend/src/pages`.
2. Use **Source Control → Initialize Repository**, review the changes, and commit the project.
3. Publish the repository to GitHub. Check that no `.env` files, API keys, database passwords, or other credentials are included.

### 2. Create and configure MongoDB Atlas

1. Create a MongoDB Atlas cluster and database named `smolcomp` (or choose another name and update `DB_NAME`).
2. Create a database user with a strong password and copy the MongoDB connection string.
3. Configure Atlas Network Access for the backend host. Avoid opening database access to all IP addresses for a production deployment; use the host's supported static egress/networking option where possible.

### 3. Deploy the backend to Render

1. In Render, create a **Blueprint** from the GitHub repository and select the repository's `render.yaml`, or create a Web Service manually with the settings below.
2. For a manual service, set the root directory to `backend`, the build command to `pip install -r requirements.txt`, and the start command to `uvicorn server:app --host 0.0.0.0 --port $PORT`.
3. In the Render service's environment settings, provide the variables prompted by `render.yaml`. For the initial `CORS_ORIGINS` value, use `http://localhost:3000`; replace it with the deployed frontend's exact HTTPS origin after Vercel is ready.
   - `MONGO_URL`: the Atlas connection URI
   - `DB_NAME`: `smolcomp`
   - `JWT_SECRET`: a newly generated, long random secret
   - `STRIPE_API_KEY`: use a Stripe **test** secret key while testing
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: set a real admin login and a unique strong password
   - `CORS_ORIGINS`: set this after deploying the frontend, to its exact HTTPS origin (for example `https://your-site.vercel.app`)
4. Wait for the service to become healthy. The API health check is `https://<your-render-service>.onrender.com/api/`; interactive API documentation is at `/docs`.

The backend reads environment settings at startup. `EMERGENT_LLM_KEY` is optional and is only needed for the configured object-storage integration; add it privately in Render if required. Without it, storage-dependent upload features may not work.

A fresh database has no catalog content. To load the bundled sample seasons, artworks, boxes, and polls, configure `backend/.env` with the intended database, then run this once from the repository root:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
py seed.py
```

The sample customer and artist accounts with published demo passwords are disabled by default; `SEED_DEMO_USERS=true` enables them for local demos only. Do not enable that option in production. The API seeds the admin account from the private `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings.

### 4. Deploy the frontend to Vercel

1. Import the same GitHub repository in Vercel.
2. Set the project root to `frontend`, the build command to `yarn build`, and the output directory to `build`.
3. Set `REACT_APP_API_URL` to the backend origin, such as `https://smolcomp-api.onrender.com` (do not append `/api`).
4. Deploy the frontend. `frontend/vercel.json` is included to route client-side paths back to the React app.
5. Copy the deployed frontend's HTTPS origin into Render's `CORS_ORIGINS` setting, then redeploy/restart the backend.

The backend uses secure, cross-origin auth cookies. For production, test sign-in in the browsers you plan to support; privacy settings may block cross-site cookies when the frontend and API use their default Vercel and Render domains. A custom frontend/API domain pair under the same registrable domain (for example `app.example.com` and `api.example.com`) is the more reliable production setup.

### 5. Verify the deployment

- Open the frontend and check that its main pages load, including a direct refresh on a nested route.
- Open the API health check and `/docs`.
- Check Render logs for startup/database errors.
- Test authentication and checkout with non-production test accounts and Stripe test mode.
- Before going live, replace the Stripe test key with the live key in Render only, configure the corresponding Stripe webhook, and verify the payment flow end to end.

## Local backend setup (Windows PowerShell)

The backend loads `backend/.env`; start the commands from the backend directory:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env with your local MongoDB and development credentials.
uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

The sample environment file is a template, not usable credentials. Keep your real `.env` file private.

For the frontend, open a second VS Code terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
corepack yarn install --frozen-lockfile
corepack yarn start
```

The local API URL defaults to `http://localhost:8000`. Configure the real hosted backend origin in Vercel as `REACT_APP_API_URL`.

## Deployment files

- `render.yaml` defines the Render FastAPI service and the environment variables that must be supplied privately.
- `frontend/vercel.json` enables client-side routing on Vercel.
- `frontend/.env.example` documents the frontend's local API URL.
- `backend/.env.example` documents the backend's local environment variables.
