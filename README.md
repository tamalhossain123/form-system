# Form System

A Google Forms clone with one extra superpower Google Forms does not have:
**placing a field beside another field** — including a dedicated
"Product + quantity" field where the quantity box (for example,
"কতো গ্রাম / How many grams") sits right beside each product name.

Built with Vite + React, React Router (HashRouter) and Supabase
(Postgres + Auth + Storage). No backend server of your own is needed,
and the static build works on GitHub Pages under any repo subpath.

## Features

- **Dashboard** that looks like the Google Forms home page: "Start a new
  form" (blank form or the *Gift & Trust Box Product Inventory* template),
  searchable Recent forms grid, publish state, per-form menu (Open,
  Copy responder link, Delete).
- **Editor** with Questions / Responses / Requests / Settings tabs,
  autosave, and a floating toolbar (add question, text block, image
  block, section).
- **All Google Forms question types**: short answer, paragraph, multiple
  choice, checkboxes, dropdown, file upload, linear scale, rating,
  multiple choice grid, checkbox grid, date, time — plus text blocks,
  image blocks, the "beside next field" toggle, and the product+quantity
  field.
- **Sections with navigation**: per-option "go to section" (dropdown and
  multiple choice), per-section "after section" behaviour, Back / Next,
  required-question validation, Clear form, and progress autosaved to the
  browser with a "Your progress has been restored" toast.
- **Public or Private forms**: public forms can be filled by anyone with
  the link; private forms show an access-request screen. You approve or
  deny requests in the Requests tab and send each approved person their
  personal token link.
- **Responses**: Summary (with charts/totals, including per-product
  quantity totals), per-Question view, Individual view (print/delete),
  spreadsheet Table view, and CSV export.

## Setup

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the dashboard open **SQL Editor**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates
   the `forms`, `responses` and `access_requests` tables and the public
   `uploads` storage bucket.

### 2. Create the owner (admin) account

In Supabase go to **Authentication → Users → Add user** and create the
email/password you will sign in with. (Email confirmation can be left on;
confirm the address from the email Supabase sends, or turn confirmation
off under Authentication → Providers → Email for a smoother first run.)
You can also use the "Create owner account" button on the app's login
page.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your project values
(Supabase dashboard → Project Settings → API):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run it

```bash
npm install
npm run dev      # local development
npm run build    # production build into dist/
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. Run `npm run build`.
3. Publish the `dist/` folder with GitHub Pages (for example with the
   `gh-pages` branch approach, or GitHub Actions "Static HTML" workflow).
   The Vite `base` is already set to `./`, so the app works from a repo
   subpath such as `https://username.github.io/form-system/`.
4. Note: the `.env` values are compiled into the build. The anon key is
   safe to ship publicly — data access is controlled by the RLS policies
   in `supabase/schema.sql` (see the single-owner note at the top of that
   file).

## How private-form access works

1. In the editor, open **Settings** and set the form to **Private**.
2. Share the normal responder link. Visitors see a request-access form
   (name, email, message).
3. Requests land in the editor's **Requests** tab. Click **Approve**,
   then copy that person's personal link (it contains their
   `?token=...`) and send it to them.
4. The personal link opens the form directly. An approved person who
   lost the link can also enter their email on the form page ("Already
   approved?") to be taken to it.

## Send responses to Google Sheets (optional)

In addition to the built-in Responses views, every new response can also
be appended as a row in a Google Sheet, using a small Google Apps Script
webhook. The script lives in [`apps-script/Code.gs`](apps-script/Code.gs).

1. Open the Google Sheet that should receive the responses.
2. Click **Extensions → Apps Script**, delete the existing code, and
   paste in the whole of `apps-script/Code.gs`.
3. Click **Deploy → New deployment**, choose **Web app**, set
   **Execute as: Me** and **Who has access: Anyone**, then deploy and
   approve the permission prompts.
4. Copy the Web App URL (it ends in `/exec`).
5. In the Form System app, open the form's **Settings** tab and paste
   the URL into the **Google Sheets** field.

From then on, each submitted response is also sent to the script, which
appends it to a tab named after the form's title (creating the tab and
any new question columns automatically, with a `Submitted At` column
first). The Sheets copy is best-effort: if the webhook fails, the
response is still saved normally in the app. One Web App URL can be
reused for several forms — each form gets its own tab — or you can use
a different sheet/script per form.
