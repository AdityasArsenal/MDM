import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy',
};

const RefundPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Refund Policy</h1>
        </div>
      </header>
      <main className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Commitment</h2>
              <p className="text-lg text-gray-600">
                At Data Canvas, we are dedicated to providing a reliable and valuable service to help school teachers and staff manage food expenses efficiently. Our goal is to ensure you are satisfied with our web-based automation tool. This policy outlines the terms under which refunds and cancellations are handled.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Refund Eligibility</h2>
              <p className="text-lg text-gray-600 mb-2">
                Our services are offered on a subscription basis. Refunds are handled as follows:
              </p>
              <ul className="list-disc list-inside text-lg text-gray-600 space-y-2">
                <li>
                  <strong>Monthly Subscriptions:</strong> You cannot cancel or undo the subscription. We are not providing any refund for our services.
                </li>
                <li>
                  <strong>3 MONTH Subscriptions:</strong> You cannot cancel or undo the subscription. We are not providing any refund for our services.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Us</h2>
              <p className="text-lg text-gray-600">
                If you have any questions about our Refund Policy, please contact us at <a href="mailto:support@gov.nonexistential.dev" className="text-blue-600 hover:underline">ady@nonexistential.dev</a>. We are here to help and will do our best to address your concerns.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RefundPolicyPage;
