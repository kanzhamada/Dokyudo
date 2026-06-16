# reCAPTCHA v3 returns a score for each request without user friction. The score is based on interactions with your site and enables you to take an appropriate action for your site. Register reCAPTCHA v3 keys on the [reCAPTCHA Admin console](https://www.google.com/recaptcha/admin/create).

This page explains how to enable and customize reCAPTCHA v3 on your webpage.

## Placement on your website

reCAPTCHA v3 will never interrupt your users, so you can run it whenever you like without affecting
conversion. reCAPTCHA works best when it has the most context about interactions with your site,
which comes from seeing both legitimate and abusive behavior. For this reason, we recommend
including reCAPTCHA verification on forms or actions as well as in the background of pages for
analytics.

> [!NOTE]
> **Note:** reCAPTCHA tokens expire after two minutes. If you're protecting an action with reCAPTCHA, make sure to call `execute` when the user takes the action rather than on page load.

You can execute reCAPTCHA on as many actions as you want on the same page.

## Automatically bind the challenge to a button

The easiest method for using reCAPTCHA v3 on your page is to include the
necessary JavaScript resource and add a few attributes to your html button.

1. Load the JavaScript API.

        <script src="https://www.google.com/recaptcha/api.js"></script>

2. Add a callback function to handle the token.

        <script>
          function onSubmit(token) {
            document.getElementById("demo-form").submit();
          }
        </script>

3. Add attributes to your html button.

       <button class="g-recaptcha" 
               data-sitekey="reCAPTCHA_site_key" 
               data-callback='onSubmit' 
               data-action='submit'>Submit</button>

## Programmatically invoke the challenge

If you wish to have more control over when reCAPTCHA runs, you can use the
`execute` method in `grecaptcha` object. To do this,
you need to add a `render` parameter to the reCAPTCHA script load.

1. Load the JavaScript API with your sitekey.

       <script src="https://www.google.com/recaptcha/api.js?render=reCAPTCHA_site_key"></script>

2. Call `grecaptcha.execute` on each action you wish to protect.

          <script>
             function onClick(e) {
               e.preventDefault();
               grecaptcha.ready(function() {
                 grecaptcha.execute('reCAPTCHA_site_key', {action: 'submit'}).then(function(token) {
                     // Add your logic to submit to your backend server here.
                 });
               });
             }
         </script>

3. Send the token immediately to your backend with the request to
   [verify](https://developers.google.com/recaptcha/docs/verify).

## Interpreting the score

reCAPTCHA v3 returns a score (1.0 is very likely a good interaction, 0.0 is very likely a bot).
Based on the score, you can take variable action in the context of your site. Every site is
different, but below are some examples of how sites use the score. As in the examples below, take
action behind the scenes instead of blocking traffic to better protect your site.

| Use case | Recommendation |
|---|---|
| homepage | See a cohesive view of your traffic on the admin console while filtering scrapers. |
| login | With low scores, require 2-factor-authentication or email verification to prevent credential stuffing attacks. |
| social | Limit unanswered friend requests from abusive users and send risky comments to moderation. |
| e-commerce | Put your real sales ahead of bots and identify risky transactions. |

reCAPTCHA learns by seeing real traffic on your site. For this reason, scores in a staging
environment or soon after implementing may differ from production. As reCAPTCHA v3 doesn't ever
interrupt the user flow, you can first run reCAPTCHA without taking action and then decide on
thresholds by looking at your traffic in the [admin console](https://g.co/recaptcha/admin). By
default, you can use a threshold of 0.5.

## Actions

reCAPTCHA v3 introduces a new concept: actions. When you specify an action name
in each place you execute reCAPTCHA, you enable the following new features:

- A detailed break-down of data for your top ten actions in the [admin console](https://g.co/recaptcha/admin/)
- Adaptive risk analysis based on the context of the action, because abusive behavior can vary.

Importantly, when you verify the reCAPTCHA response, you should verify that the
action name is the name you expect.

> [!NOTE]
> **Note:** Actions might contain only alphanumeric characters, slashes, and underscores. Actions must not be user-specific.

## Site Verify Response

Make the request to [verify the response token](https://developers.google.com/recaptcha/docs/verify) as with reCAPTCHA v2 or
Invisible reCAPTCHA.

The response is a JSON object:

    {
      "success": true|false,      // whether this request was a valid reCAPTCHA token for your site
      "score": number             // the score for this request (0.0 - 1.0)
      "action": string            // the action name for this request (important to verify)
      "challenge_ts": timestamp,  // timestamp of the challenge load (ISO format yyyy-MM-dd'T'HH:mm:ssZZ)
      "hostname": string,         // the hostname of the site where the reCAPTCHA was solved
      "error-codes": [...]        // optional
    }

### Tips

1. `grecaptcha.ready()` runs your function when the reCAPTCHA library loads. To avoid race conditions with the `api.js`, include the `api.js` before your scripts that call grecaptcha, or continue to use the [onload callback](https://developers.google.com/recaptcha/docs/display#explicit_render) that's defined with the v2 API.
2. Try hooking the `execute` call to interesting or sensitive actions like Register, Password Reset, Purchase, or Play.
3. Use `https://www.google.com/recaptcha/api.js?trustedtypes=true` to load code compatible with [Trusted Types](https://web.dev/trusted-types/).

# Verifying the user&#39;s response

This page explains how to verify a user's response to a reCAPTCHA challenge from your application's
backend.

For web users, you can get the user's response token in one of three ways:

- `g-recaptcha-response` POST parameter when the user submits the form on your site
- [`grecaptcha.getResponse(opt_widget_id)`](https://developers.google.com/recaptcha/docs/display#js_api) after the user completes the reCAPTCHA challenge
- As a string argument to your [callback function](https://developers.google.com/recaptcha/docs/display#render_param) if `data-callback` is specified in either the `g-recaptcha` tag attribute or the callback parameter in the `grecaptcha.render` method

For Android library users, you can call the
[SafetyNetApi.RecaptchaTokenResult.getTokenResult()](https://developers.google.com/android/reference/com/google/android/gms/safetynet/SafetyNetApi.RecaptchaTokenResult.html#getTokenResult())
method to get response token if the status returns successful.

## Token Restrictions

Each reCAPTCHA user response token is valid for two minutes, and can only be verified *once* to
prevent replay attacks. If you need a new token, you can re-run the reCAPTCHA verification.

After you get the response token, you need to verify it within two minutes with reCAPTCHA using the
following API to ensure the token is valid.

## API Request

URL: `https://www.google.com/recaptcha/api/siteverify`

METHOD: `POST`

| POST Parameter | Description |
|---|---|
| `secret` | Required. The shared key between your site and reCAPTCHA. |
| `response` | Required. The user response token provided by the reCAPTCHA client-side integration on your site. |
| `remoteip` | Optional. The user's IP address. |

## API Response

The response is a JSON object:

    {
      "success": true|false,
      "challenge_ts": timestamp,  // timestamp of the challenge load (ISO format yyyy-MM-dd'T'HH:mm:ssZZ)
      "hostname": string,         // the hostname of the site where the reCAPTCHA was solved
      "error-codes": [...]        // optional
    }

For reCAPTCHA Android:

    {
      "success": true|false,
      "challenge_ts": timestamp,  // timestamp of the challenge load (ISO format yyyy-MM-dd'T'HH:mm:ssZZ)
      "apk_package_name": string, // the package name of the app where the reCAPTCHA was solved
      "error-codes": [...]        // optional
    }

### Error code reference

| Error code               | Description                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| `missing-input-secret`   | The secret parameter is missing.                                                |
| `invalid-input-secret`   | The secret parameter is invalid or malformed.                                   |
| `missing-input-response` | The response parameter is missing.                                              |
| `invalid-input-response` | The response parameter is invalid or malformed.                                 |
| `bad-request`            | The request is invalid or malformed.                                            |
| `timeout-or-duplicate`   | The response is no longer valid: either is too old or has been used previously. |

# Loading reCAPTCHA

This document discusses best practices for loading the reCAPTCHA script tag.
This information is applicable to both reCAPTCHA v2 and v3.

## Loading reCAPTCHA asynchronously

All versions of the reCAPTCHA can be loaded asynchronously. Loading reCAPTCHA
asynchronously does not impact its ability to identify suspicious traffic. Due
to the performance benefits of asynchronous scripts, loading reCAPTCHA
asynchronously is generally recommended.

    <script async src="https://www.google.com/recaptcha/api.js">

When loading reCAPTCHA asynchronously, keep in mind that reCAPTCHA cannot be
used until it has finished loading. For example, the following code would likely
break:

    <script async src="https://www.google.com/recaptcha/api.js"></script>
    <script>
      // If reCAPTCHA is still loading, grecaptcha will be undefined.
      grecaptcha.ready(function(){
        grecaptcha.render("container", {
          sitekey: "ABC-123"
        });
      });
    </script>

In some situations, adjusting script ordering can be enough to prevent race
conditions. Alternatively, you can prevent race conditions by including the
following code snippet on pages that load reCAPTCHA. If you are using
`grecaptcha.ready()` to wrap API calls, add the following code snippet to ensure
that reCAPTCHA can be called at any time.

    <script async src="https://www.google.com/recaptcha/api.js"></script>
    <script>
      // How this code snippet works:
      // This logic overwrites the default behavior of `grecaptcha.ready()` to
      // ensure that it can be safely called at any time. When `grecaptcha.ready()`
      // is called before reCAPTCHA is loaded, the callback function that is passed
      // by `grecaptcha.ready()` is enqueued for execution after reCAPTCHA is
      // loaded.
      if(typeof grecaptcha === 'undefined') {
        grecaptcha = {
          ready: function(cb) {
            // window.__grecaptcha_cfg is a global variable that stores reCAPTCHA's
            // configuration. By default, any functions listed in its 'fns' property
            // are automatically executed when reCAPTCHA loads.
            const c = '___grecaptcha_cfg';
            window[c] = window[c] || {};
            (window[c]['fns'] = window[c]['fns'] || []).push(cb);
          }
        };
      }

      // Usage
      grecaptcha.ready(function(){
        grecaptcha.render("container", {
          sitekey: "ABC-123"
        });
      });
    </script>

As an alternative, sites that use the v2 API may find it useful to use
the `onload` callback; the `onload` callback is executed when reCAPTCHA finishes
loading. The `onload` callback should be defined before loading the reCAPTCHA
script.

    <script>
      const onloadCallback = function() {
        console.log("reCAPTCHA has loaded!");
        grecaptcha.reset();
      };
    </script>
    <script async src="https://www.google.com/recaptcha/api.js?onload=onloadCallback"></script>

If loading reCAPTCHA asynchronously is not an option, including `preconnect`
resource hints for reCAPTCHA is strongly recommended. This will minimize the
amount of time that the script download blocks the parser.

## Using resource hints

Including the following resource hints in the `<head>` of the document will
reduce the amount of time that it takes to deliver the resources used by
reCAPTCHA. The `preconnect` resource hint instructs the browser to establish an
early connection with a third-party origin.

    <link rel="preconnect" href="https://www.google.com">
    <link rel="preconnect" href="https://www.gstatic.com" crossorigin>

## Lazy Loading

Generally speaking, the more context that reCAPTCHA has about a page, the better
informed it is to determine whether user actions are legitimate. This is
particularly true when using versions of reCAPTCHA that don't rely on user
challenges. Thus, waiting to load reCAPTCHA until a specific restricted action
occurs (for example, form submission) is generally not recommended.
