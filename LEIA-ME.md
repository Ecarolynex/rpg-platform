# Frontend do Aldermoor — como integrar

## 1. Instalar dependência nova
Este frontend usa rotas, então instale o React Router no seu projeto:

```
npm install react-router-dom
```

## 2. Copiar os arquivos
Copie o conteúdo desta pasta para dentro do seu projeto `rpg-platform`,
sobrescrevendo os seguintes arquivos do scaffold padrão:

- `index.html`
- `src/index.css`
- `src/main.tsx`
- `src/App.tsx`

E adicionando as pastas novas: `src/components/`, `src/pages/`,
`src/context/`, `src/types/`, `src/data/`, `src/services/`.

## 3. Arquivos que podem ser apagados
Não são mais usados: `src/App.css`, `src/assets/react.svg`,
`src/assets/vite.svg`. Pode manter o `public/favicon.svg` e
`public/icons.svg` — não têm relação com o que foi criado aqui.

## 4. O que já funciona
- **Login** (`/entrar`) — autenticação simulada: qualquer usuário/senha
  preenchidos funcionam.
- **Dashboard** (`/`) — lista os personagens vindos de
  `src/data/mockCharacters.ts`.
- **Ficha de personagem** (`/personagem/:id`) — abas de Atributos,
  Perícias, Inventário, Magias e Notas.

## 5. Conectando ao seu banco de dados real
Toda a comunicação passa por `src/services/api.ts`. Quando o backend
estiver no ar, crie um arquivo `.env` na raiz do projeto com:

```
VITE_API_URL=https://sua-api.com
```

Assim que essa variável existir, o app para de usar os dados de
exemplo e passa a chamar `/auth/login`, `/characters` e
`/characters/:id` na sua API. Ajuste os endpoints em `api.ts` conforme
o formato do seu backend.

## 6. Identidade visual
- Fontes: **Cinzel** (títulos) e **EB Garamond** (texto), carregadas
  via Google Fonts no `index.html`.
- Paleta e tokens de cor ficam em `src/index.css` (`:root`), então dá
  para ajustar o tom geral (mais escuro, mais dourado etc.) em um só
  lugar.
- "Aldermoor" é um nome de exemplo — troque pelo nome do seu mundo em
  `Login.tsx` e `AppShell.tsx`.

## 7. Próximos passos sugeridos
- Tela de criação/edição de personagem.
- Página de campanhas e bestiário (já estão no menu, mas sem rota
  ainda).
- Rolagem de dados.
