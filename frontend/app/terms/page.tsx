'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';

export default function TermsAndConditionsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Terms and Conditions</h1>
          <p className="mt-2 text-lg text-gray-600">Last updated: August 01, 2025</p>
        </div>
      </header>
      
      <main className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button 
            onClick={() => router.push('/dashboard')} 
            variant="outline" 
            className="mb-6 text-black"
          >
            ← Back to Dashboard
          </Button>

          <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Introduction</h2>
              <p className="text-lg text-gray-700">
                Welcome to Data Canvas ("we," "our," or "us"). Our web-based automation tool, accessible at gov.nonexistential.dev, is designed to assist school teachers and staff in tracking and calculating monthly food expenses for submission to the Karnataka government. By using our services, you agree to comply with and be bound by these Terms and Conditions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Service Description</h2>
              <p className="text-lg text-gray-700">
                Data Canvas provides a platform that processes data from user-uploaded spreadsheets to generate pre-calculated columns and produce a formatted PDF report for submission. The service is intended for professional use by school personnel to streamline administrative tasks.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">3. User Responsibilities</h2>
              <p className="text-lg text-gray-700 mb-2">
                As a user of Data Canvas, you agree to:
              </p>
              <ul className="list-disc list-inside text-lg text-gray-700 space-y-2">
                <li>Provide accurate and lawful data for processing. You are solely responsible for the content you upload.</li>
                <li>Use the service for its intended purpose of food expense tracking and reporting.</li>
                <li>Maintain the confidentiality of your Google OAuth credentials used to access our service.</li>
                <li>Not use the service for any illegal or unauthorized purpose.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Service Usage</h2>
              <p className="text-lg text-gray-700">
                Data Canvas is provided as a subscription service to assist school personnel in their administrative tasks. We reserve the right to modify or discontinue features at any time with reasonable notice to users.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">5. Intellectual Property</h2>
              <p className="text-lg text-gray-700">
                All intellectual property rights related to the Data Canvas application, including its software, design, and branding, are owned by us. You are granted a limited, non-exclusive, non-transferable license to use the service. You retain ownership of the data you upload.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">6. Limitation of Liability</h2>
              <p className="text-lg text-gray-700">
                Data Canvas is provided "as is." We do not guarantee that the service will be error-free or uninterrupted. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service, including any inaccuracies in the generated reports.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">7. Dispute Resolution</h2>
              <p className="text-lg text-gray-700">
                Any disputes arising out of or in connection with these terms shall be resolved through binding arbitration in accordance with the laws of Karnataka, India. Before resorting to arbitration, we encourage you to contact our support team to seek a resolution.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">8. Refund Policy</h2>
              <p className="text-lg text-gray-700 mb-2">
                Our services are offered on a subscription basis. Refunds are handled as follows:
              </p>
              <ul className="list-disc list-inside text-lg text-gray-700 space-y-2">
                <li>
                  <strong>Monthly Subscriptions:</strong> You cannot cancel or undo the subscription. We are not providing any refund for our services.
                </li>
                <li>
                  <strong>3 Month Subscriptions:</strong> You cannot cancel or undo the subscription. We are not providing any refund for our services.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">9. Changes to Terms</h2>
              <p className="text-lg text-gray-700">
                We reserve the right to modify these Terms and Conditions at any time. We will notify you of any changes by posting the new terms on our website. Your continued use of the service after such changes constitutes your acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">10. Contact Information</h2>
              <p className="text-lg text-gray-700">
                For any questions about these Terms and Conditions, please contact us at{' '}
                <a href="mailto:ady@nonexistential.dev" className="text-blue-600 hover:underline">
                  ady@nonexistential.dev
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
