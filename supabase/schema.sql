create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  username text unique not null,
  password text not null,
  role text not null check (role in ('administrador','vendedor','deposito')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id bigint generated always as identity primary key,
  category text not null,
  name text not null,
  size text not null,
  color text not null,
  print text,
  code text unique not null,
  stock integer not null default 0,
  sold integer not null default 0,
  produced integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists movements (
  id bigint generated always as identity primary key,
  user_name text not null,
  type text not null check (type in ('Ingreso','Venta','Producción')),
  product_code text not null,
  product_label text not null,
  quantity integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id bigint generated always as identity primary key,
  seller_name text not null,
  customer_name text not null,
  phone text,
  email text,
  street text,
  number text,
  floor text,
  locality text,
  province text,
  postal_code text,
  notes text,
  items_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table inventory_items;
alter publication supabase_realtime add table movements;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table users;

insert into users (name, username, password, role, active)
values
('Admin Co.Carter', 'admin', 'admin123', 'administrador', true),
('Vendedor 1', 'vendedor1', 'venta123', 'vendedor', true),
('Depósito 1', 'deposito1', 'stock123', 'deposito', true)
on conflict (username) do nothing;

insert into inventory_items (category, name, size, color, print, code, stock, sold, produced)
values
('Body manga larga', 'Body blanco osito', '3 meses', 'Blanco', 'Osito', 'BOD001', 15, 8, 23),
('Body manga larga', 'Body blanco osito', '6 meses', 'Blanco', 'Osito', 'BOD002', 10, 5, 15),
('Pijama', 'Pijama estrellas', '9 meses', 'Celeste', 'Estrellas', 'PIJ001', 8, 6, 14),
('Campera', 'Campera plush', '12 meses', 'Rosa', 'Sin estampa', 'CAM001', 0, 5, 5),
('Conjuntos', 'Conjunto frisa liso', '24 meses', 'Beige', 'Sin estampa', 'CON001', 2, 4, 6)
on conflict (code) do nothing;
