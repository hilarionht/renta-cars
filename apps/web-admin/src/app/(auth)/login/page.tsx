import { Suspense } from 'react';

import { LoginForm } from './login-form';

// useSearchParams (?next=) requiere un limite de Suspense en el App Router.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
