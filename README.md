# smolComp

smolComp is a React single-page application with a FastAPI API and MongoDB storage. The API also supports Stripe payments and an optional object-storage integration.

## Deployment readiness

The original frontend page files were absent from this copy, so the frontend has been reconstructed from the routes in `frontend/src/App.js`, `design_guidelines.json`, and the FastAPI endpoints. The reconstructed pages call the backend, but they are not a verified recovery of the original UI. The production frontend build has been verified; the complete checkout/authentication flow still needs testing against configured MongoDB and Stripe services.

The project also needs deployment-specific settings and external services: a MongoDB database and secure admin credentials. Stripe checkout is optional and stays disabled until a test API key is configured. Do not commit credentials or put backend secrets in frontend variables.

## Deploy from VS Code

The deployment setup uses GitHub as the source, Render for the FastAPI backend, MongoDB Atlas for the database, and Firebase Hosting for the React frontend. Firebase Hosting can serve the static frontend on its free Spark plan; the FastAPI backend remains on Render.

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
3. In the Render service's environment settings, provide the variables prompted by `render.yaml`. For the initial `CORS_ORIGINS` value, use `http://localhost:3000`; replace it with the deployed frontend's exact HTTPS origin after Firebase Hosting is ready.
   - `MONGO_URL`: the Atlas connection URI
   - `DB_NAME`: `smolcomp`
   - `JWT_SECRET`: a newly generated, long random secret
   - `STRIPE_API_KEY`: optional; add a Stripe **test** secret key to enable checkout
   - `STRIPE_WEBHOOK_SECRET`: optional; add the endpoint signing secret to enable verified webhook events
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: set a real admin login and a unique strong password
   - `CORS_ORIGINS`: set this after deploying the frontend, to its exact HTTPS origin (for example `https://your-project-id.web.app`)
4. Wait for the service to become healthy. The API health check is `https://<your-render-service>.onrender.com/api/`; interactive API documentation is at `/docs`.

The backend reads environment settings at startup. Without `STRIPE_API_KEY`, checkout is disabled while the rest of the API can run; payment verification via webhooks also requires `STRIPE_WEBHOOK_SECRET`. `EMERGENT_LLM_KEY` is optional and is only needed for the configured object-storage integration; add it privately in Render if required. Without it, storage-dependent upload features may not work.

A fresh database has no catalog content. After deploying the backend and signing in to the admin page, use **Set up sample seasons & artists** to load the bundled seasons, artworks, blind boxes, polls, approved sample artist profiles, and a sample customer account. The action is safe to repeat: existing sample records are left in place. Newly created demo passwords are generated at setup time and shown only once in the admin page; save them privately if you want to test the artist and customer portals.

For local development, you can still configure `backend/.env` with the intended database and load the bundled catalog from the backend directory:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
py seed.py
```

The sample customer and artist accounts with published demo passwords are disabled by default; `SEED_DEMO_USERS=true` enables those legacy accounts for local demos only. Do not enable that option in production. The admin setup page instead creates approved sample artists and a customer preview with unique generated passwords. The API seeds the admin account from the private `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings.

The gallery includes an approved-artists directory and a browser-local shopping basket. Basket contents are not an order: checkout remains unavailable until Stripe is configured, and no payment is taken by the demo.

The admin studio lists all accounts returned by the API, supports artist approval and artist-submission review, and manages seasons, collections, artwork, blind boxes, and polls. The account list refreshes automatically every 15 seconds and can also be refreshed manually.

### 4. Deploy the frontend to Firebase Hosting

1. Create a Firebase project in the Firebase console and keep it on the **Spark (no-cost)** plan. Do not enable billing or select the Blaze plan.
2. Install and sign in to the Firebase CLI from the repository root:

   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

   Select the project you created and use the `default` alias. The root `firebase.json` is already configured to publish `frontend/build` and route client-side paths to `index.html`.
3. Set the frontend's API origin and build it:

   ```powershell
   $env:REACT_APP_API_URL = "https://smolcomp.onrender.com"
   corepack yarn --cwd frontend install --frozen-lockfile
   corepack yarn --cwd frontend build
   ```

   Replace the API origin if your Render service uses a different URL. Do not append `/api`.
4. Publish the frontend:

   ```powershell
   firebase deploy --only hosting
   ```

5. Copy the deployed `https://<project-id>.web.app` origin into Render's `CORS_ORIGINS` setting, then redeploy/restart the backend.

The backend uses secure, cross-origin auth cookies. For production, test sign-in in the browsers you plan to support; privacy settings may block cross-site cookies when the frontend and API use their default Firebase and Render domains. A custom frontend/API domain pair under the same registrable domain (for example `app.example.com` and `api.example.com`) is the more reliable production setup.

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

The local API URL defaults to `http://localhost:8000`. Configure the real hosted backend origin as `REACT_APP_API_URL` before building the frontend for Firebase Hosting.

## Deployment files

- `render.yaml` defines the Render FastAPI service and the environment variables that must be supplied privately.
- `firebase.json` configures Firebase Hosting to publish the frontend build and support client-side routing.
- `frontend/vercel.json` is retained for optional Vercel deployments.
- `frontend/.env.example` documents the frontend's local API URL.
- `backend/.env.example` documents the backend's local environment variables.
