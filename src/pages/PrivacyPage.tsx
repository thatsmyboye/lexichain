import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

// The app stores list this page's URL (https://lexichain.banton-digital.com/privacy)
// as the privacy policy. Keep it in step with what the game actually collects,
// and with the App Store privacy labels and Google Play data-safety form.
// The analytics section describes the Google Tag Manager snippet in index.html,
// which is skipped in the native app.
//
// Set this to the address players should write to about their data. The
// contact section is hidden while it is empty; both stores expect one.
const PRIVACY_CONTACT_EMAIL = "";
const LAST_UPDATED = "November 23, 2026";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 px-4 py-8">
      <div className="container mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        <article className="prose prose-sm dark:prose-invert max-w-none sm:prose-base">
          <h1 className="font-display">Privacy policy</h1>
          <p className="text-muted-foreground">Last updated {LAST_UPDATED}</p>

          <p>
            Lexichain is a word game you can play on the web and in the Lexichain app for iOS and
            Android. This policy explains what information the game uses and why. Lexichain has no
            ads and no in-app purchases. The web version uses Google Analytics to count visits; the
            iOS and Android apps contain no analytics or tracking.
          </p>

          <h2>Playing without an account</h2>
          <p>
            You can play every mode without signing up. Your settings, trophies, personal bests and
            daily-puzzle progress are stored only on your device (in the browser's or app's local
            storage). They are not sent to us. Clearing the app's data or uninstalling it removes them.
          </p>

          <h2>Analytics on the web</h2>
          <p>
            When you play in a web browser, the game loads Google Analytics through Google Tag
            Manager. It tells us how many people visit, which pages they open and roughly how they
            use the site. Google receives your IP address, your browser and device type, the pages
            you view and actions such as clicks and scrolling, and it sets cookies to tell visits
            apart. We use these statistics only to understand and improve the game. They are not
            linked to your account, your display name or your game results.
          </p>
          <p>
            The Lexichain apps for iOS and Android do not load Google Analytics. On the web you can
            opt out with a content blocker or Google's{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
              Analytics opt-out browser add-on
            </a>
            .
          </p>

          <h2>If you create an account</h2>
          <p>An account lets you appear on leaderboards and keep results across devices. We store:</p>
          <ul>
            <li>your email address and a securely hashed password, used to sign you in;</li>
            <li>the display name you choose, which is shown publicly on leaderboards;</li>
            <li>
              your game results: mode, score, words found, longest word, moves and time played, daily
              challenge and puzzle results, goals, and your daily login streak;
            </li>
            <li>an in-progress daily challenge, so you can resume it on another device.</li>
          </ul>
          <p>
            We use this information only to run the game: signing you in, saving your results, and
            showing leaderboards and statistics. We do not sell it or share it for advertising.
          </p>

          <h2>Services we use</h2>
          <ul>
            <li>
              <strong>Supabase</strong> hosts the account database and sign-in.
            </li>
            <li>
              <strong>Vercel</strong> hosts the game. Like any web host, it receives your IP address
              and device type when the game loads.
            </li>
            <li>
              <strong>Google Analytics</strong> and <strong>Google Tag Manager</strong> measure
              visits to the web version, as described above. They are not used in the apps.
            </li>
            <li>
              <strong>Free Dictionary API</strong> (dictionaryapi.dev) supplies word definitions on the
              results screen. Only the word being looked up is sent.
            </li>
          </ul>

          <h2>Sharing</h2>
          <p>
            When you share a result, the text or image goes only where you send it, through your
            device's share sheet. Daily challenge share cards hide the board's letters.
          </p>

          <h2>Deleting your data</h2>
          <p>
            Signed in, open <strong>My Account</strong> and choose <strong>Delete my account</strong>.
            This permanently deletes your account, display name and all saved results from our
            servers straight away. Data stored only on your device is removed when you clear the
            app's data or uninstall it.
          </p>

          <h2>Children</h2>
          <p>
            Lexichain is suitable for all ages but is not directed at children under 13, and we do not
            knowingly collect personal information from them. A child can play without an account.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes, the new version will be posted on this page with a new date.
          </p>

          {PRIVACY_CONTACT_EMAIL && (
            <>
              <h2>Contact</h2>
              <p>
                Questions or requests about your data:{" "}
                <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
              </p>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
