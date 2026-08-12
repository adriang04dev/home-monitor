-- Perfiles con rol (device o dashboard)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('device', 'dashboard')) not null,
  device_name text,
  created_at timestamp with time zone default now()
);

-- Lecturas de consumo energetico
create table if not exists energy_readings (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) not null,
  device_name text not null,
  consumption_kwh numeric not null,
  voltage numeric,
  current_amps numeric,
  notes text,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;
alter table energy_readings enable row level security;

-- Cada usuario ve y edita solo su propio perfil
create policy "Ver mi perfil" on profiles
  for select using (auth.uid() = id);

create policy "Crear mi perfil" on profiles
  for insert with check (auth.uid() = id);

-- Un device solo puede insertar sus propias lecturas
create policy "Device inserta sus lecturas" on energy_readings
  for insert with check (auth.uid() = user_id);

-- Un device puede ver sus propias lecturas
create policy "Device ve sus lecturas" on energy_readings
  for select using (auth.uid() = user_id);

-- Un dashboard puede ver todas las lecturas
create policy "Dashboard ve todo" on energy_readings
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'dashboard'
    )
  );
