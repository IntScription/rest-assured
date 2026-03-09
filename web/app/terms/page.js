export default function TermsOfService() {
  return (
    <main style={styles.container}>
      <h1>Terms of Service</h1>
      <p><strong>Last updated:</strong> March 2026</p>

      <h2>1. Use of Service</h2>
      <p>
        By using Rest Assured, you agree to use the app only for lawful purposes.
      </p>

      <h2>2. Account Responsibility</h2>
      <p>
        You are responsible for maintaining the security of your account.
      </p>

      <h2>3. Fitness Disclaimer</h2>
      <p>
        Rest Assured provides workout tracking tools only.
        We are not responsible for injuries or health issues resulting from exercise.
        Consult a medical professional before beginning any fitness program.
      </p>

      <h2>4. Service Availability</h2>
      <p>
        We may modify or discontinue features at any time without notice.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        We are not liable for indirect or incidental damages arising from the use of the app.
      </p>

      <h2>6. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms.
      </p>

      <h2>7. Governing Law</h2>
      <p>
        These terms are governed by applicable local laws.
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
