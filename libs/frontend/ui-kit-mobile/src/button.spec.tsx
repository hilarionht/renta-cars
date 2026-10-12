import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it('llama onPress al tocar', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no llama onPress cuando esta disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} disabled testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('no llama onPress mientras esta loading, y no muestra el label', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} loading testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Guardar')).toBeNull();
  });
});
