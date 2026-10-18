-- Remover cor/tamanho do cadastro só desativa (preserva histórico e estoque).
ALTER TABLE cores ADD COLUMN ativo boolean NOT NULL DEFAULT true;
ALTER TABLE tamanhos ADD COLUMN ativo boolean NOT NULL DEFAULT true;
