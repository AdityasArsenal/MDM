'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';

export default function InstructionsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">How to Use MDM Management System</h1>
          <p className="mt-2 text-lg text-gray-600">Complete guide to managing your school's meal data</p>
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
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Getting Started</h2>
              <p className="text-lg text-gray-700 mb-4">
                The MDM Management System helps you track and manage meal planning, stock inventory, milk distribution, and egg/banana records for your school.
              </p>
              <ol className="list-decimal list-inside text-lg text-gray-700 space-y-2">
                <li>Log in using your Google account</li>
                <li>Complete payment for subscription access</li>
                <li>Access the Dashboard to select your desired sheet</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Dashboard Overview</h2>
              <p className="text-lg text-gray-700 mb-4">
                From the Dashboard, you can access four different management sheets:
              </p>
              <ul className="list-disc list-inside text-lg text-gray-700 space-y-2">
                <li><strong>Meal Planning (MDM ದೈನಂದಿನ ದಾಸ್ತಾನು):</strong> Track daily meal distribution for children</li>
                <li><strong>Milk & Ragi (ಹಾಲು ಮತ್ತು ರಾಗಿ):</strong> Manage milk and ragi malt distribution</li>
                <li><strong>Stock Management (ದಿನಸಿ ನಿರ್ವಹಣಾ):</strong> Monitor rice, wheat, oil, and pulse inventory</li>
                <li><strong>Egg & Banana (ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆ):</strong> Record egg and banana distribution</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Using the Meal Planning Sheet</h2>
              <ol className="list-decimal list-inside text-lg text-gray-700 space-y-2">
                <li>Select the month and year from the dropdowns</li>
                <li>For each day, select the meal type (Rice/ಅಕ್ಕಿ or Wheat/ಗೋಧಿ)</li>
                <li>Indicate whether pulses (ಬೇಳೆ) are included (Yes/No)</li>
                <li>Enter the number of children in age groups 1-5 and 6-10</li>
                <li>The system automatically calculates ingredient quantities</li>
                <li>Click "Save All" to save your data</li>
                <li>Use "Download PDF" to export the report</li>
              </ol>
              <p className="text-lg text-gray-700 mt-4">
                <strong>Note:</strong> Sundays are highlighted in red and are typically non-working days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Using the Milk & Ragi Sheet</h2>
              <ol className="list-decimal list-inside text-lg text-gray-700 space-y-2">
                <li>Select the month and year</li>
                <li>Enter the number of children for each day</li>
                <li>For the first day of the month, enter opening stock for milk and ragi</li>
                <li>Enter received quantities (ತಿಂಗಳ ಸ್ವೀಕೃತಿ) when new stock arrives</li>
                <li>Select distribution type (milk & ragi, milk only, or ragi only)</li>
                <li>The system calculates totals and closing stock automatically</li>
                <li>Save and export as needed</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Using the Stock Management Sheet</h2>
              <ol className="list-decimal list-inside text-lg text-gray-700 space-y-2">
                <li>Select the month and year</li>
                <li>On the first day of the month, enter opening stock for rice, wheat, oil, and pulses</li>
                <li>Enter incoming stock (ತಿಂಗಳ ಸ್ವೀಕೃತಿ) when supplies are received</li>
                <li>The system automatically calculates daily usage based on meal planning data</li>
                <li>View opening stock, totals, daily distribution, and closing stock for both age groups (1-5 and 6-10)</li>
                <li>Save and export your records</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Using the Egg & Banana Sheet</h2>
              <ol className="list-decimal list-inside text-lg text-gray-700 space-y-2">
                <li>Select the month and year</li>
                <li>Set the price per egg and banana at the top</li>
                <li>For each day, select who is paying (APF or GOV)</li>
                <li>Enter quantities for male (M) and female (F) children</li>
                <li>The system calculates totals and costs automatically</li>
                <li>View the summary showing APF vs GOV totals</li>
                <li>Save and export as needed</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Tips & Best Practices</h2>
              <ul className="list-disc list-inside text-lg text-gray-700 space-y-2">
                <li>Always save your data before switching between sheets</li>
                <li>Use the month/year selector to navigate between different periods</li>
                <li>Export PDFs regularly for record-keeping and government submission</li>
                <li>Opening stock for each month should match the closing stock from the previous month</li>
                <li>Double-check calculations before submitting reports</li>
                <li>Keep your subscription active to maintain access to your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Need Help?</h2>
              <p className="text-lg text-gray-700">
                If you encounter any issues or have questions, please contact support at{' '}
                <a href="mailto:ady@nonexistential.dev" className="text-blue-600 hover:underline">
                  ady@nonexistential.dev
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
