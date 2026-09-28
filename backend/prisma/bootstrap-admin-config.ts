export function loadBootstrapAdminEmails(): [string, string] {
  const emails = [1, 2].map((index) => {
    const email = process.env[`BOOTSTRAP_ADMIN_${index}_EMAIL`]
      ?.trim()
      .toLowerCase();
    if (
      !email ||
      email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(`BOOTSTRAP_ADMIN_${index}_EMAIL is missing or invalid`);
    }
    return email;
  }) as [string, string];

  if (emails[0] === emails[1]) {
    throw new Error(
      'The two configured ADMIN email addresses must be distinct',
    );
  }
  return emails;
}
