-- ===== ระบบรับเข้าสัญญาซื้อขาย: สร้างตารางเก็บสัญญา + กฎความปลอดภัย =====
-- รันครั้งเดียวใน Supabase > SQL Editor

-- ตารางเก็บสัญญา 1 แถว = สัญญา 1 ฉบับ
create table if not exists public.contracts (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorder       text not null default (auth.jwt() ->> 'email'),   -- ผู้บันทึก (อีเมล)
  company        text not null default '' check (company in ('', 'yongsawat', 'amata')),
  customer       text not null check (length(trim(customer)) > 0),
  received_date  date not null,                                     -- วันที่ได้รับสัญญา
  deliver_date   date not null,                                     -- วันที่ต้องส่งของ
  receipt_date   date,                                              -- วันที่ได้รับใบเสร็จ (ว่าง = ยังไม่ได้รับ)
  guarantee_sent boolean not null default false,                    -- ส่งเอกสารรอถอนเงินค้ำแล้ว
  created_at     timestamptz not null default now()
);

-- กันการปลอมชื่อผู้บันทึก: ระบบใส่เจ้าของและอีเมลให้เอง และห้ามเปลี่ยนเจ้าของภายหลัง
create or replace function public.contracts_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.recorder := auth.jwt() ->> 'email';
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.recorder := old.recorder;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_set_owner on public.contracts;
create trigger contracts_set_owner
  before insert or update on public.contracts
  for each row execute function public.contracts_set_owner();

-- เปิดระบบล็อกข้อมูล: ไม่มีกฎอนุญาต = ไม่มีใครเห็น
alter table public.contracts enable row level security;

-- ต้องเข้าสู่ระบบแล้วเท่านั้น จึงดูสัญญาของทุกคนได้
drop policy if exists "read_all_signed_in" on public.contracts;
create policy "read_all_signed_in" on public.contracts
  for select to authenticated using (true);

-- เพิ่ม / แก้ / ลบ ได้เฉพาะสัญญาของตัวเอง
drop policy if exists "insert_own" on public.contracts;
create policy "insert_own" on public.contracts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update_own" on public.contracts;
create policy "update_own" on public.contracts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete_own" on public.contracts;
create policy "delete_own" on public.contracts
  for delete to authenticated using (user_id = auth.uid());

-- คนที่ไม่ได้เข้าสู่ระบบ ห้ามแตะตารางนี้เลย
revoke all on public.contracts from anon;
