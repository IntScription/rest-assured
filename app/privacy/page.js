export default function PrivacyPolicy() {
  return (
    <main style={styles.container}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> March 2026</p>

      <h2>1. Information We Collect</h2>
      <p>
        When you use Rest Assured, we may collect:
      </p>
      <ul>
        <li>Name</li>
        <li>Email address (via Google or Apple login)</li>
        <li>Workout and exercise data you create</li>
        <li>Basic usage analytics to improve the app</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide authentication and account access</li>
        <li>Store and display your workout data</li>
        <li>Improve app features and performance</li>
        <li>Respond to support inquiries</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>
        We use third-party services for authentication and database management.
        These services may process your data according to their own privacy policies.
      </p>

      <h2>4. Data Security</h2>
      <p>
        We implement reasonable measures to protect your information.
        However, no system is completely secure.
      </p>

      <h2>5. Data Deletion</h2>
      <p>
        You may request deletion of your account and associated data by contacting:
        <br />
        <strong>support@restassuredapp.com</strong>
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time.
        Updates will be reflected on this page.
      </p>

      <h2>7. Contact</h2>
      <p>
        If you have questions, contact:
        <br />
        <strong>support@restassuredapp.com</strong>
      </p>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px 20px",
    lineHeight: "1.6",
  },
};
