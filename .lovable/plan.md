## Problem

Auth logs show your sign-up requests returning **422** and sign-in returning **400 invalid_credentials**. The cause: email confirmation is currently required. When you sign up, the account is created but stays unconfirmed — so:

- Signing in fails with "invalid credentials" (confirmation required)
- Retrying sign-up fails with 422 ("user already registered")

You also won't actually receive the confirmation email because no custom email provider is wired up.

## Fix

Turn on **auto-confirm email** on the backend so new accounts are immediately usable. No code changes needed — just one auth setting toggle.

After that:
1. Use a fresh email (the ones you already tried are stuck as unconfirmed).
2. Password must be at least 6 characters.
3. Sign up → you'll be sent straight into the app.
4. Or use **Continue with Google**, which already works without confirmation.

## Optional follow-up

Also surface a clearer message on the auth screen when sign-up returns "already registered" so it's obvious to switch to Sign In. (Small UX polish — let me know if you want it.)
