-- Lopes: schema inicial (catálogo, estoque, baixas, usuários)

CREATE TABLE usuarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  pin_hash    text NOT NULL,
  papel       text NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin', 'operador')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_nome_uq ON usuarios (lower(nome));

-- A ordem das listas é a ordem de separação no PDF.
CREATE TABLE cores (
  id     serial PRIMARY KEY,
  nome   text NOT NULL,
  ordem  integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX cores_nome_uq ON cores (lower(nome));

CREATE TABLE tamanhos (
  id     serial PRIMARY KEY,
  nome   text NOT NULL,
  ordem  integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX tamanhos_nome_uq ON tamanhos (upper(nome));

-- Saldo atual por variação (cor x tamanho). O histórico fica em movimentos.
CREATE TABLE estoque (
  cor_id      integer NOT NULL REFERENCES cores(id) ON DELETE CASCADE,
  tamanho_id  integer NOT NULL REFERENCES tamanhos(id) ON DELETE CASCADE,
  quantidade  integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cor_id, tamanho_id)
);

-- Uma linha por "Dar baixa". Desfazer marca desfeito_em e devolve as peças.
CREATE TABLE lotes_baixa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  usuario_id  uuid REFERENCES usuarios(id),
  pedidos     integer NOT NULL,
  pecas       integer NOT NULL,
  desfeito_em timestamptz,
  desfeito_por uuid REFERENCES usuarios(id)
);

-- Cada pedido só pode ser baixado uma vez (PK impede baixa duplicada, mesmo com dois usuários ao mesmo tempo).
CREATE TABLE pedidos_baixados (
  chave      text PRIMARY KEY,
  lote_id    uuid NOT NULL REFERENCES lotes_baixa(id) ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pedidos_baixados_lote_idx ON pedidos_baixados (lote_id);

CREATE TABLE movimentos (
  id          bigserial PRIMARY KEY,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  usuario_id  uuid REFERENCES usuarios(id),
  tipo        text NOT NULL CHECK (tipo IN ('baixa', 'ajuste', 'entrada', 'estorno')),
  cor_id      integer NOT NULL REFERENCES cores(id),
  tamanho_id  integer NOT NULL REFERENCES tamanhos(id),
  delta       integer NOT NULL,
  lote_id     uuid REFERENCES lotes_baixa(id),
  nota        text
);
CREATE INDEX movimentos_criado_idx ON movimentos (criado_em DESC);

CREATE TABLE config (
  chave  text PRIMARY KEY,
  valor  jsonb NOT NULL
);

-- Valores iniciais: os mesmos do app (lista inicial de cores e tamanhos).
INSERT INTO cores (nome, ordem) VALUES
  ('Bege', 1), ('Preto', 2), ('Caramelo', 3), ('Verde Menta', 4), ('Verde Musgo', 5),
  ('Vermelho Marsala', 6), ('Azul Bebê', 7), ('Azul Escuro', 8), ('Rosa Bebê', 9), ('Amarelo Bebê', 10);
INSERT INTO tamanhos (nome, ordem) VALUES ('P', 1), ('M', 2), ('G', 3), ('GG', 4);
INSERT INTO config (chave, valor) VALUES ('estoque_minimo', '5'::jsonb);
