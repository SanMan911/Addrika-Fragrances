const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `Forgot Username — Recover Your Username`,
  description: `Recover your ${BRAND.name} username using your registered mobile number. Get back to your account easily.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './ForgotUsernameClient';
