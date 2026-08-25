import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from './text-field';

describe('TextField', () => {
  it('muestra el label y llama onChangeText al escribir', () => {
    const onChangeText = jest.fn();
    render(<TextField label="Email" value="" onChangeText={onChangeText} testID="input" />);

    expect(screen.getByText('Email')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('input'), 'a@a.com');

    expect(onChangeText).toHaveBeenCalledWith('a@a.com');
  });

  it('muestra el mensaje de error cuando se pasa', () => {
    render(
      <TextField label="Email" value="" onChangeText={jest.fn()} errorMessage="Campo requerido" />,
    );

    expect(screen.getByText('Campo requerido')).toBeTruthy();
  });
});
