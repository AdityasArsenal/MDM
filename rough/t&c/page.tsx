import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-lg text-gray-500">Last updated: August 01, 2025</p>
        </div>
      </header>
      <main className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Our Commitment to Privacy</h2>
              <p className="text-lg text-gray-600">
                Data Canvas ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our web-based automation tool at gov.nonexistential.dev. Your use of our service signifies your acceptance of this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Data Collection</h2>
              <p className="text-lg text-gray-600 mb-2">
                We are transparent about the data we collect and are guided by the principle of data minimization.
              </p>
              <ul className="list-disc list-inside text-lg text-gray-600 space-y-2">
                <li>
                  <strong>Authentication Data:</strong> We use Google OAuth for user authentication. This means we do not handle or store your passwords. We only receive basic profile information from Google, such as your email address and name, to identify you as a user.
                </li>
                <li>
                  <strong>User-Provided Data:</strong> We do not collect or store any data from the spreadsheets you upload unless you explicitly choose to save your work on our platform. If you do save a sheet, the data contained within it will be stored on our secure servers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">3. Data Protection and Storage</h2>
              <p className="text-lg text-gray-600">
                We implement robust security measures to protect your data. Any information you choose to save is encrypted both in transit and at rest. We use industry-standard security protocols to prevent unauthorized access, disclosure, or alteration of your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Data Sharing</h2>
              <p className="text-lg text-gray-600">
                We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. Your data is used exclusively to provide and improve the Data Canvas service. We may share anonymized, aggregate data for analytical purposes, but this will not contain any personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">5. Use of Cookies</h2>
              <p className="text-lg text-gray-600">
                We use cookies to enhance your experience on our site. These are small files that a site or its service provider transfers to your computer's hard drive through your web browser (if you allow) that enable the site's or service provider's systems to recognize your browser and capture and remember certain information. We primarily use cookies to understand and save your preferences for future visits and to compile aggregate data about site traffic and site interaction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">6. Your Rights</h2>
              <p className="text-lg text-gray-600">
                You have the right to access, update, or delete the information we have on you. If you have saved data on our platform, you can manage it directly from your account dashboard. For any requests regarding your data, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">7. Changes to This Policy</h2>
              <p className="text-lg text-gray-600">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">8. Contact Us</h2>
              <p className="text-lg text-gray-600">
                If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@gov.nonexistential.dev" className="text-blue-600 hover:underline">ady@nonexistential.dev</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
