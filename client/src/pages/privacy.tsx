import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            Juice Trends
          </Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/login" className="hover:text-primary">Login</Link>
            <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12 max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>Last updated: March 28, 2026</p>
        
        <h2>1. Introduction</h2>
        <p>Welcome to Juice Trends. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>

        <h2>2. The Data We Collect About You</h2>
        <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
        <ul>
          <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
          <li><strong>Contact Data</strong> includes email address.</li>
          <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
          <li><strong>Profile Data</strong> includes your username and password, your interests, preferences, feedback and survey responses.</li>
          <li><strong>Usage Data</strong> includes information about how you use our website, products and services.</li>
        </ul>

        <h2>3. How We Use Your Personal Data</h2>
        <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
        <ul>
          <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
          <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
          <li>Where we need to comply with a legal obligation.</li>
        </ul>

        <h2 id="delete_account">4. Data Deletion Instructions</h2>
        <p>If you wish to delete your account and all associated data, you can do so by following these steps:</p>
        <ol>
          <li>Log in to your Juice Trends account.</li>
          <li>Navigate to the <strong>Settings</strong> page from the sidebar.</li>
          <li>Scroll down to the <strong>Danger Zone</strong> section.</li>
          <li>Click on the <strong>Delete Account</strong> button.</li>
          <li>Confirm your decision when prompted.</li>
        </ol>
        <p>Alternatively, you can send an email to support@juicetrends.com with the subject line "Account Deletion Request" from the email address associated with your account. We will process your request within 30 days.</p>

        <h2>5. Contact Us</h2>
        <p>If you have any questions about this privacy policy or our privacy practices, please contact us at support@juicetrends.com.</p>
      </main>
    </div>
  );
}
