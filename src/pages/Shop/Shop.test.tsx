import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Shop from './Shop';

vi.mock('../../services/api', () => ({
  getCharacters: vi.fn().mockResolvedValue([
    {
      id: 'char-1',
      campanhaId: 'teste',
      nome: 'Aventureiro Teste',
      raca: 'Humano',
      classe: 'Guerreiro',
      nivel: 3,
      hp: { atual: 30, max: 30 },
      mp: { atual: 10, max: 10 },
      attributes: { forca: 16, destreza: 14, constituicao: 15, inteligencia: 10, carisma: 8 },
      skills: [],
      inventory: [],
      spells: [],
      carteira: { pc: 0, pp: 0, pe: 0, po: 1250, pl: 0 },
      notas: '',
    },
  ]),
  getCampaignAccess: vi.fn().mockResolvedValue({ isMaster: true, startingGold: 1250 }),
  listarPersonagensDaCampanha: vi.fn().mockResolvedValue([{
    id: 'char-1',
    campanhaId: 'teste',
    nome: 'Aventureiro Teste',
    raca: 'Humano',
    classe: 'Guerreiro',
    nivel: 3,
    hp: { atual: 30, max: 30 },
    mp: { atual: 10, max: 10 },
    attributes: { forca: 16, destreza: 14, constituicao: 15, inteligencia: 10, carisma: 8 },
    skills: [],
    inventory: [],
    spells: [],
    carteira: { pc: 0, pp: 0, pe: 0, po: 1250, pl: 0 },
    notas: '',
  }]),
  listarMinhasCampanhas: vi.fn().mockResolvedValue([{
    id: 'campanha-teste',
    nome: 'Crônicas de Elementum',
    descricao: null,
    sistema: 'Elementum RPG',
    imagem_url: null,
    moeda_principal: 'Ouro',
    ouro_inicial: 1250,
    status: 'ATIVA',
    codigo_convite: 'ABC123',
    created_by: 'mestre-teste',
    created_at: '2026-09-29T00:00:00.000Z',
  }]),
  listarItensDaLoja: vi.fn().mockResolvedValue([
    {
      id: 'item-1',
      campanhaId: 'teste',
      itemId: 'item-base-1',
      nome: 'Espada do Crepúsculo',
      descricao: 'Uma lâmina de aço escurecido forjada sob luas gêmeas.',
      tipo: 'ARMA',
      raridade: 'RARO',
      efeito: '+2 em testes de ataque com pouca luz',
      imagemUrl: '',
      precoCompra: 250,
      precoVenda: 125,
      estoque: 3,
      ativo: true,
      vendaPermitida: true,
    },
    {
      id: 'item-2',
      campanhaId: 'teste',
      itemId: 'item-base-2',
      nome: 'Poção de Cura',
      descricao: 'Líquido vermelho brilhante com cheiro adocicado.',
      tipo: 'CONSUMIVEL',
      raridade: 'COMUM',
      efeito: 'Recupera 2d4 + 2 pontos de vida',
      imagemUrl: '',
      precoCompra: 50,
      precoVenda: 25,
      estoque: 10,
      ativo: true,
      vendaPermitida: true,
    },
    {
      id: 'item-3',
      campanhaId: 'teste',
      itemId: 'item-base-3',
      nome: 'Amuleto do Pescador',
      descricao: 'Um amuleto esculpido em madrepérola.',
      tipo: 'ACESSORIO',
      raridade: 'INCOMUM',
      efeito: 'Vantagem em testes de Sobrevivência na água',
      imagemUrl: '',
      precoCompra: 180,
      precoVenda: 90,
      estoque: 5,
      ativo: true,
      vendaPermitida: true,
    },
  ]),
  listarCatalogoItens: vi.fn().mockResolvedValue([
    {
      itemId: 'item-base-reutilizavel',
      nome: 'Capa Arcana',
      descricao: 'Uma capa de proteção.',
      tipo: 'ARMADURA',
      raridade: 'INCOMUM',
      efeito: '+2 em Inteligência',
      imagemUrl: '',
    },
  ]),
  enviarRetrato: vi.fn().mockResolvedValue('https://cdn.example.com/shop-card.png'),
  adicionarItemExistenteNaLoja: vi.fn().mockResolvedValue('store-item-added'),
  removerItemDaLoja: vi.fn().mockResolvedValue(undefined),
  comprarCarrinho: vi.fn().mockResolvedValue({
    personagem_id: 'char-1',
    saldo_po: 890,
    total_gasto: 360,
  }),
  salvarItemDaLoja: vi.fn().mockImplementation(async (input) => ({
    id: input.lojaItemId ?? 'store-item-created',
    lojaId: 'loja-teste',
    itemId: 'item-base-created',
    campanhaId: input.campanhaId,
    nome: input.nome,
    descricao: input.descricao,
    tipo: input.tipo,
    raridade: input.raridade,
    efeito: input.efeito,
    imagemUrl: input.imagemUrl,
    precoCompra: input.precoCompra,
    precoVenda: null,
    estoque: input.estoque,
    vendaPermitida: true,
    ativo: input.ativo,
  })),
}));

describe('Shop', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exibe a Loja e os itens do catálogo', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Loja' })).toBeInTheDocument();
    expect(screen.getAllByText('Loja')).toHaveLength(1);
    const headerActions = screen.getByRole('banner').querySelector('.shop-header-actions');
    expect(headerActions?.firstElementChild).toHaveClass('shop-wallet');
    expect(headerActions?.lastElementChild).toHaveClass('shop-cart-link');
    expect(screen.getAllByText(/espada do crepúsculo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/poção de cura/i).length).toBeGreaterThan(0);
    const amuletCard = screen.getByRole('article', { name: 'Amuleto do Pescador' });
    expect(within(amuletCard).getByText('180 PO')).toBeInTheDocument();
  });

  it('publica uma carta com PNG enviada ao armazenamento da campanha', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adicionar carta/i }));

    const imageInput = screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i);
    expect(imageInput).toHaveAttribute('type', 'file');
    expect(imageInput).toHaveAttribute('accept', 'image/png');

    fireEvent.change(screen.getByLabelText('Nome da carta'), { target: { value: 'Carta com arte' } });
    fireEvent.change(screen.getByLabelText('Subcategoria'), { target: { value: 'Relíquias' } });
    const bonusInput = screen.getByLabelText('Bônus do atributo');
    expect(bonusInput).not.toBeDisabled();
    fireEvent.change(bonusInput, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Atributo concedido'), { target: { value: 'Força' } });
    fireEvent.change(screen.getByLabelText('Preço em PO'), { target: { value: '325' } });
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Carta de teste com ilustração.' } });
    const imageFile = new File(['png-data'], 'carta.png', { type: 'image/png' });
    fireEvent.change(imageInput, {
      target: { files: [imageFile] },
    });

    expect(await screen.findByRole('img', { name: 'Prévia da carta' })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('heading', { name: 'Nova carta da loja' }).closest('form')!);
    expect(await screen.findByRole('img', { name: 'Carta com arte' })).toBeInTheDocument();
    const createdCard = screen.getByRole('article', { name: 'Carta com arte' });
    expect(within(createdCard).getByText('325 PO')).toBeInTheDocument();
    expect(within(createdCard).getByText('4 em estoque')).toBeInTheDocument();
    expect(within(createdCard).getByText('+5 Força')).toBeInTheDocument();

    const { enviarRetrato, salvarItemDaLoja } = await import('../../services/api');
    expect(vi.mocked(enviarRetrato)).toHaveBeenCalledWith(imageFile);
    expect(vi.mocked(salvarItemDaLoja).mock.calls[0][0].imagemUrl).toBe(
      'https://cdn.example.com/shop-card.png',
    );
  });

  it('recusa formatos diferentes de PNG, imagens vazias e imagens maiores que 3 MB', async () => {
    const { enviarRetrato } = await import('../../services/api');
    vi.mocked(enviarRetrato).mockClear();
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adicionar carta/i }));
    const imageInput = screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i);
    fireEvent.change(imageInput, {
      target: { files: [new File(['jpeg-data'], 'carta.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('A imagem da carta deve ser um arquivo PNG.')).toBeInTheDocument();

    fireEvent.change(imageInput, {
      target: { files: [new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('A imagem da carta deve ter no máximo 3 MB.')).toBeInTheDocument();

    fireEvent.change(imageInput, {
      target: { files: [new File([], 'vazia.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('A imagem da carta não pode estar vazia.')).toBeInTheDocument();
    expect(vi.mocked(enviarRetrato)).not.toHaveBeenCalled();
  });

  it('mostra erro quando a leitura do preview lança uma exceção síncrona', async () => {
    const { enviarRetrato } = await import('../../services/api');
    vi.mocked(enviarRetrato).mockClear();
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => {
      throw new DOMException('Invalid state', 'InvalidStateError');
    });

    try {
      render(
        <MemoryRouter initialEntries={['/campanha/teste/loja']}>
          <Routes>
            <Route path="/campanha/:id/loja" element={<Shop />} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByRole('button', { name: /adicionar carta/i }));
      fireEvent.change(screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i), {
        target: { files: [new File(['png-data'], 'carta.png', { type: 'image/png' })] },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível ler a imagem selecionada. Tente novamente.',
      );
      expect(screen.queryByRole('img', { name: 'Prévia da carta' })).not.toBeInTheDocument();
      expect(enviarRetrato).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }
  });

  it('não reusa um arquivo PNG anterior se uma seleção inválida for feita ao editar', async () => {
    const { enviarRetrato, listarItensDaLoja, salvarItemDaLoja } = await import('../../services/api');
    vi.mocked(enviarRetrato).mockClear();
    vi.mocked(salvarItemDaLoja).mockClear();
    const existingImageUrl = 'https://cdn.example.com/existing-card.png';
    vi.mocked(listarItensDaLoja).mockResolvedValueOnce([{
      id: 'item-edit-image',
      lojaId: 'loja-teste',
      itemId: 'item-base-edit-image',
      campanhaId: 'teste',
      nome: 'Carta existente com imagem',
      descricao: 'Uma carta que já possui arte.',
      tipo: 'ARMA',
      raridade: 'COMUM',
      efeito: null,
      imagemUrl: existingImageUrl,
      precoCompra: 100,
      precoVenda: null,
      estoque: 1,
      vendaPermitida: true,
      ativo: true,
    }]);

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    const existingCard = await screen.findByRole('article', { name: 'Carta existente com imagem' });
    fireEvent.click(within(existingCard).getByRole('button', { name: 'Editar' }));
    const imageInput = screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i);
    fireEvent.change(imageInput, {
      target: { files: [new File(['valid-png'], 'novo.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Prévia da carta' })).toHaveAttribute(
        'src',
        expect.stringContaining('data:image/png;base64'),
      );
    });

    fireEvent.change(imageInput, {
      target: { files: [new File(['invalid-jpeg'], 'nova.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('A imagem da carta deve ser um arquivo PNG.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Prévia da carta' })).toHaveAttribute('src', existingImageUrl);

    fireEvent.submit(screen.getByRole('heading', { name: 'Editar carta da loja' }).closest('form')!);
    await waitFor(() => expect(salvarItemDaLoja).toHaveBeenCalledTimes(1));
    expect(enviarRetrato).not.toHaveBeenCalled();
    expect(vi.mocked(salvarItemDaLoja).mock.calls[0][0].imagemUrl).toBe(existingImageUrl);
  });

  it('mantém a loja aberta e exibe falhas de upload ou salvamento', async () => {
    const { enviarRetrato, salvarItemDaLoja } = await import('../../services/api');
    vi.mocked(enviarRetrato).mockRejectedValueOnce(new Error('Falha de rede no upload.'));
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adicionar carta/i }));
    fireEvent.change(screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i), {
      target: { files: [new File(['png-data'], 'carta.png', { type: 'image/png' })] },
    });
    fireEvent.submit(screen.getByRole('heading', { name: 'Nova carta da loja' }).closest('form')!);

    expect(await screen.findByText('Falha de rede no upload.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Loja' })).toBeInTheDocument();
    expect(vi.mocked(salvarItemDaLoja)).not.toHaveBeenCalled();

    vi.mocked(enviarRetrato).mockResolvedValueOnce('https://cdn.example.com/retry.png');
    vi.mocked(salvarItemDaLoja).mockRejectedValueOnce(new Error('Falha ao gravar a carta.'));
    fireEvent.submit(screen.getByRole('heading', { name: 'Nova carta da loja' }).closest('form')!);

    expect(await screen.findByText(/imagem enviada, mas a carta não foi salva\. Falha ao gravar a carta\./i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Loja' })).toBeInTheDocument();
  });

  it('mantém a loja funcional quando o localStorage lança QuotaExceededError', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      render(
        <MemoryRouter initialEntries={['/campanha/teste/loja']}>
          <Routes>
            <Route path="/campanha/:id/loja" element={<Shop />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Loja' })).toBeInTheDocument();
      expect(await screen.findByRole('article', { name: 'Espada do Crepúsculo' })).toBeInTheDocument();
      expect(setItemSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('quota'),
        expect.any(DOMException),
      );
    } finally {
      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('não persiste imagens Base64 no cache local da loja', async () => {
    const { listarItensDaLoja } = await import('../../services/api');
    vi.mocked(listarItensDaLoja).mockResolvedValueOnce([{
      id: 'item-base64',
      lojaId: 'loja-teste',
      itemId: 'item-base64',
      campanhaId: 'teste',
      nome: 'Carta com imagem Base64',
      descricao: 'Imagem grande.',
      tipo: 'ARMA',
      raridade: 'COMUM',
      efeito: null,
      imagemUrl: 'data:image/png;base64,aW1hZ2U=',
      precoCompra: 100,
      precoVenda: null,
      estoque: 1,
      vendaPermitida: true,
      ativo: true,
    }]);

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('article', { name: 'Carta com imagem Base64' })).toBeInTheDocument();
    const storedItems = window.localStorage.getItem('rpg-platform-shop-teste') ?? '';
    expect(storedItems).not.toContain('data:image/png;base64');
  });

  it('mostra as ações de administração abaixo do painel e permite editar cartas', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    const adminHeading = await screen.findByRole('heading', { name: 'Administrar loja' });
    const activeCharacter = screen.getByText('Personagem ativo');
    expect(adminHeading.compareDocumentPosition(activeCharacter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByRole('heading', { name: 'Editar carta da loja' })).toBeInTheDocument();
    expect(screen.getByLabelText(/imagem da carta \(png, até 3 mb\)/i)).toHaveAttribute('accept', 'image/png');
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome da carta'), { target: { value: 'Carta revisada' } });
    fireEvent.change(screen.getByLabelText('Preço em PO'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('heading', { name: 'Carta revisada' })).toBeInTheDocument();
    const revisedCard = screen.getByRole('article', { name: 'Carta revisada' });
    expect(within(revisedCard).getByText('999 PO')).toBeInTheDocument();
  });

  it('seleciona todas ou várias cartas e reutiliza as escolhidas com preço e estoque comuns', async () => {
    const { adicionarItemExistenteNaLoja, listarCatalogoItens } = await import('../../services/api');
    vi.mocked(adicionarItemExistenteNaLoja).mockClear();
    vi.mocked(listarCatalogoItens).mockResolvedValueOnce([
      {
        itemId: 'catalog-sword',
        nome: 'Espada da Aurora',
        descricao: 'Lâmina encantada.',
        tipo: 'ARMA',
        raridade: 'RARO',
        efeito: '+1 ataque',
        imagemUrl: null,
      },
      {
        itemId: 'catalog-cloak',
        nome: 'Manto da Névoa',
        descricao: 'Manto leve.',
        tipo: 'ARMADURA',
        raridade: 'INCOMUM',
        efeito: null,
        imagemUrl: null,
      },
      {
        itemId: 'catalog-ring',
        nome: 'Anel das Marés',
        descricao: 'Anel antigo.',
        tipo: 'ACESSORIO',
        raridade: 'COMUM',
        efeito: null,
        imagemUrl: null,
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Aventureiro Teste' });
    fireEvent.click(await screen.findByRole('button', { name: 'Reutilizar cartas' }));
    const swordCheckbox = await screen.findByRole('checkbox', { name: 'Espada da Aurora' });
    const cloakCheckbox = screen.getByRole('checkbox', { name: 'Manto da Névoa' });
    const ringCheckbox = screen.getByRole('checkbox', { name: 'Anel das Marés' });

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }));
    expect(swordCheckbox).toBeChecked();
    expect(cloakCheckbox).toBeChecked();
    expect(ringCheckbox).toBeChecked();
    fireEvent.click(ringCheckbox);
    expect(screen.getByText('2 de 3 selecionadas')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Preço em PO (para todas)'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Estoque (para todas)'), { target: { value: '3' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2 cartas à campanha' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Reutilizar cartas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reutilizar cartas do catálogo' })).not.toBeInTheDocument();
    expect(vi.mocked(adicionarItemExistenteNaLoja)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adicionarItemExistenteNaLoja)).toHaveBeenNthCalledWith(
      1,
      'teste',
      'catalog-sword',
      400,
      3,
    );
    expect(vi.mocked(adicionarItemExistenteNaLoja)).toHaveBeenNthCalledWith(
      2,
      'teste',
      'catalog-cloak',
      400,
      3,
    );
  });

  it('mantém selecionados somente os itens que falharam na reutilização em lote', async () => {
    const { adicionarItemExistenteNaLoja, listarCatalogoItens, listarItensDaLoja } = await import('../../services/api');
    vi.mocked(adicionarItemExistenteNaLoja)
      .mockResolvedValueOnce('offer-created')
      .mockRejectedValueOnce(new Error('Falha ao adicionar esta carta.'));
    const catalogItems = [
      {
        itemId: 'catalog-success',
        nome: 'Carta adicionada',
        descricao: 'Foi adicionada.',
        tipo: 'ARMA',
        raridade: 'COMUM',
        efeito: null,
        imagemUrl: null,
      },
      {
        itemId: 'catalog-failure',
        nome: 'Carta com falha',
        descricao: 'Falhou ao adicionar.',
        tipo: 'ACESSORIO',
        raridade: 'INCOMUM',
        efeito: null,
        imagemUrl: null,
      },
    ];
    vi.mocked(listarCatalogoItens)
      .mockResolvedValueOnce(catalogItems)
      .mockResolvedValueOnce(catalogItems);
    const existingItems = await listarItensDaLoja('teste');
    vi.mocked(listarItensDaLoja)
      .mockResolvedValueOnce(existingItems)
      .mockResolvedValueOnce([
        ...existingItems,
        {
          id: 'offer-created',
          lojaId: 'loja-teste',
          itemId: 'catalog-success',
          campanhaId: 'teste',
          nome: 'Carta adicionada',
          descricao: 'Foi adicionada.',
          tipo: 'ARMA',
          raridade: 'COMUM',
          efeito: null,
          imagemUrl: null,
          precoCompra: 100,
          precoVenda: null,
          estoque: 1,
          vendaPermitida: true,
          ativo: true,
        },
      ]);

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Aventureiro Teste' });
    fireEvent.click(await screen.findByRole('button', { name: 'Reutilizar cartas' }));
    await screen.findByRole('checkbox', { name: 'Carta com falha' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2 cartas à campanha' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/1 carta\(s\) adicionada\(s\); 1 não puderam ser adicionada\(s\)/i);
    expect(screen.getByRole('article', { name: 'Carta adicionada' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Carta adicionada' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Carta com falha' })).toBeChecked();
  });

  it('confirma a exclusão definitiva da oferta sem excluir a carta-base', async () => {
    const { removerItemDaLoja } = await import('../../services/api');
    vi.mocked(removerItemDaLoja).mockClear();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Aventureiro Teste' });
    const itemCard = await screen.findByRole('article', { name: 'Amuleto do Pescador' });
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(within(itemCard).getByRole('button', { name: 'Excluir oferta' }));
    expect(removerItemDaLoja).not.toHaveBeenCalled();
    expect(screen.getByRole('article', { name: 'Amuleto do Pescador' })).toBeInTheDocument();

    confirmSpy.mockReturnValueOnce(true);
    await act(async () => {
      fireEvent.click(within(itemCard).getByRole('button', { name: 'Excluir oferta' }));
      await Promise.resolve();
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/excluída definitivamente/i);
    expect(vi.mocked(removerItemDaLoja)).toHaveBeenCalledWith('teste', 'item-3');
    expect(screen.queryByRole('article', { name: 'Amuleto do Pescador' })).not.toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('A carta continuará no catálogo e em outros inventários.'),
    );
    confirmSpy.mockRestore();
  });

  it('não exibe a administração para um jogador', async () => {
    const { getCampaignAccess } = await import('../../services/api');
    vi.mocked(getCampaignAccess).mockResolvedValueOnce({ isMaster: false, startingGold: 500 });

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Personagem ativo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administrar loja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('seleciona uma campanha na aba Loja antes de mostrar seus itens', async () => {
    render(
      <MemoryRouter initialEntries={['/loja']}>
        <Routes>
          <Route path="/loja" element={<Shop />} />
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('link', { name: /crônicas de elementum/i }));
    expect(await screen.findByRole('heading', { name: 'Administrar loja' })).toBeInTheDocument();
  });

  it('exibe a imagem da carta dentro do modal de exame', async () => {
    const { listarItensDaLoja } = await import('../../services/api');
    vi.mocked(listarItensDaLoja).mockResolvedValueOnce([{
      id: 'carta-ilustrada',
      lojaId: 'loja-teste',
      itemId: 'item-base',
      campanhaId: 'teste',
      nome: 'Carta ilustrada',
      descricao: 'Uma lâmina encantada.',
      tipo: 'ARMA',
      raridade: 'RARO',
      efeito: '+2 Força',
      imagemUrl: 'data:image/png;base64,aW1hZ2U=',
      precoCompra: 300,
      precoVenda: null,
      estoque: 2,
      vendaPermitida: true,
      ativo: true,
    }]);

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Examinar' }));

    const modal = screen.getByRole('heading', { level: 2, name: 'Carta ilustrada' }).closest('.shop-modal');
    expect(modal).not.toBeNull();
    expect(within(modal as HTMLElement).getByRole('img', { name: 'Carta ilustrada' })).toHaveAttribute(
      'src',
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(within(modal as HTMLElement).getByText('Uma lâmina encantada.')).toBeInTheDocument();
  });

  it('leva ao carrinho, atualiza quantidades e finaliza a compra', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
          <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    const amuletCard = await screen.findByRole('article', { name: 'Amuleto do Pescador' });
    fireEvent.click(within(amuletCard).getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Carrinho 1' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Carrinho' })).toBeInTheDocument();
    const cartEntry = screen.getByRole('article', { name: /Amuleto do Pescador/ });
    fireEvent.click(within(cartEntry).getByRole('button', { name: 'Aumentar Amuleto do Pescador' }));
    expect(within(cartEntry).getByText('360 PO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar compra' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/compra concluída/i);
    const { comprarCarrinho } = await import('../../services/api');
    expect(vi.mocked(comprarCarrinho)).toHaveBeenCalledWith('char-1', [
      { lojaItemId: 'item-3', quantidade: 2 },
    ]);
    expect(screen.getByText('890 PO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sua sacola está vazia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar a loja' })).toHaveClass('shop-empty-action');
  });
});
