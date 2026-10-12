import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { PhotoPicker } from './photo-picker';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('PhotoPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza una miniatura por cada uri', () => {
    render(<PhotoPicker uris={['uri-1', 'uri-2']} onPick={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByLabelText('Quitar foto 1')).toBeTruthy();
    expect(screen.getByLabelText('Quitar foto 2')).toBeTruthy();
  });

  it('onRemove recibe el indice correcto al tocar quitar', () => {
    const onRemove = jest.fn();
    render(<PhotoPicker uris={['uri-1', 'uri-2']} onPick={jest.fn()} onRemove={onRemove} />);

    fireEvent.press(screen.getByLabelText('Quitar foto 2'));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('sin permiso concedido, no llama a onPick', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    const onPick = jest.fn();
    render(<PhotoPicker uris={[]} onPick={onPick} onRemove={jest.fn()} />);

    fireEvent.press(screen.getByText('+ Agregar foto'));

    await waitFor(() => expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled());
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('con permiso y una foto elegida, llama a onPick con la uri', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'picked-uri' }],
    });
    const onPick = jest.fn();
    render(<PhotoPicker uris={[]} onPick={onPick} onRemove={jest.fn()} />);

    fireEvent.press(screen.getByText('+ Agregar foto'));

    await waitFor(() => expect(onPick).toHaveBeenCalledWith('picked-uri'));
  });

  it('si el usuario cancela, no llama a onPick', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: null,
    });
    const onPick = jest.fn();
    render(<PhotoPicker uris={[]} onPick={onPick} onRemove={jest.fn()} />);

    fireEvent.press(screen.getByText('+ Agregar foto'));

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(onPick).not.toHaveBeenCalled();
  });
});
