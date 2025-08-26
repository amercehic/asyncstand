import { Router } from '@/router';
import { SkipLinks } from '@/components/ui';
import { PasswordProtection } from '@/components/PasswordProtection';

export default function App() {
  return (
    <PasswordProtection>
      <SkipLinks />
      <Router />
    </PasswordProtection>
  );
}
