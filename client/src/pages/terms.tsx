import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function TermsPage() {
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
            <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12 max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        <p>Last updated: March 28, 2026</p>
        
        <h2>1. Agreement to Terms</h2>
        <p>By accessing or using Juice Trends, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>

        <h2>2. Use License</h2>
        <p>Permission is granted to temporarily download one copy of the materials (information or software) on Juice Trends' website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
        <ul>
          <li>modify or copy the materials;</li>
          <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
          <li>attempt to decompile or reverse engineer any software contained on Juice Trends' website;</li>
          <li>remove any copyright or other proprietary notations from the materials; or</li>
          <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
        </ul>

        <h2>3. Disclaimer</h2>
        <p>The materials on Juice Trends' website are provided on an 'as is' basis. Juice Trends makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

        <h2>4. Limitations</h2>
        <p>In no event shall Juice Trends or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Juice Trends' website, even if Juice Trends or a Juice Trends authorized representative has been notified orally or in writing of the possibility of such damage.</p>

        <h2>5. Revisions and Errata</h2>
        <p>The materials appearing on Juice Trends' website could include technical, typographical, or photographic errors. Juice Trends does not warrant that any of the materials on its website are accurate, complete, or current. Juice Trends may make changes to the materials contained on its website at any time without notice.</p>

        <h2>6. Governing Law</h2>
        <p>These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.</p>
      </main>
    </div>
  );
}
