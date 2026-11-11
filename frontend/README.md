# smolComp frontend

This is the React frontend package. Install dependencies with the repository's Yarn 1 lockfile and run:

```powershell
yarn install --frozen-lockfile
yarn start
```

Create a production build with `yarn build`; Create React App writes it to `build/`.

The UI calls the backend at `REACT_APP_API_URL` and sends credentials for its secure auth cookies. Copy `.env.example` to `.env.local` for local work, and set the same variable in Vercel to the deployed backend origin (for example `https://smolcomp-api.onrender.com`, without `/api`).

## Deployment

The recommended hosted setup and deployment steps are in the repository [README](../README.md). For Vercel, use `frontend` as the project root and `build` as the output directory. `vercel.json` configures single-page-app routing.

This project copy now contains a reconstructed frontend for the existing API. It still needs a backend URL and a running, configured API to load real content. If you have original page/component files, compare or restore them before production use.
