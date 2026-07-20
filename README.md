# F1 Spelling Grand Prix

An F1-themed spelling and dictation practice app for children, with a parent dashboard for managing spelling lists and reviewing progress.

## Features

- Child-friendly spelling and sentence-dictation practice
- Browser text-to-speech with adjustable voice and speed
- Parent dashboard, progress history, and mistake notebook
- Gemini-powered worksheet image extraction
- Gemini-generated practice lists
- Local-first storage in the browser (`localStorage`)

## Requirements

- Node.js 20 or newer
- A Gemini API key for AI-assisted features

The core spelling practice and local hints work without a Gemini key. Image extraction and generated lists require one.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   GEMINI_API_KEY="your-key"
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

An alternative port can be supplied through the `PORT` environment variable.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Production

Build and start the Express server:

```bash
npm run build
npm start
```

The server exposes `GET /api/health` for health checks and serves the built frontend from `dist/`.

## Data and privacy

Practice lists, settings, attempts, and mistakes are stored in the current browser only. Clearing browser storage removes that data. Uploaded worksheet images and AI prompts are sent to the configured Gemini API when those features are used.

## Project origin

The initial application was generated with Google AI Studio and is now maintained as a standalone GitHub project.
