import { render, screen } from '@testing-library/react-native';

import { LoadingSpinner } from './loading-spinner';

describe('LoadingSpinner', () => {
  it('renderiza con el testID pasado', () => {
    render(<LoadingSpinner testID="spinner" />);

    expect(screen.getByTestId('spinner')).toBeTruthy();
  });
});
