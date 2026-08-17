-- =========================================================================
-- REYGAS AUTOGAS EQUIPMENT - SCRIPT DE BASE DE DATOS SUPABASE POSTGRESQL (100% CLOUD)
-- Copiar y pegar este script completo en el SQL Editor de Supabase (https://app.supabase.com)
-- y presionar RUN para crear y actualizar todas las tablas y columnas.
-- =========================================================================

-- 1. Tabla de Contenido Dinámico CMS & Backups
CREATE TABLE IF NOT EXISTS public.site_content (
    section_key TEXT PRIMARY KEY,
    key TEXT,
    value JSONB,
    content JSONB,
    category TEXT DEFAULT 'general',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS content JSONB;
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica site_content" ON public.site_content;
CREATE POLICY "Lectura y escritura publica site_content" ON public.site_content FOR ALL USING (true);

-- 2. Tabla de Vehículos (Registro & Historial)
CREATE TABLE IF NOT EXISTS public.vehicles (
    plate TEXT PRIMARY KEY,
    brand TEXT,
    model TEXT,
    year INT DEFAULT 0,
    color TEXT,
    fuel_type TEXT DEFAULT 'GNV',
    vehicle_type TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    current_mileage INT DEFAULT 0,
    last_visit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year INT DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'GNV';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS current_mileage INT DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica vehicles" ON public.vehicles;
CREATE POLICY "Lectura y escritura publica vehicles" ON public.vehicles FOR ALL USING (true);

-- 3. Tabla de Técnicos (ERP Taller)
CREATE TABLE IF NOT EXISTS public.technicians (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    allowed_tabs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS allowed_tabs JSONB;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica technicians" ON public.technicians;
CREATE POLICY "Lectura y escritura publica technicians" ON public.technicians FOR ALL USING (true);

-- 4. Tabla de Inventario de Insumos & Repuestos (Almacén)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY,
    sku_barcode TEXT,
    name TEXT NOT NULL,
    category TEXT,
    stock_quantity INT DEFAULT 0,
    unit_price NUMERIC(10,2) DEFAULT 0,
    min_stock_alert INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS sku_barcode TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS initial_stock NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS entries NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS exits NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS counted_stock NUMERIC(10,2);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS counted_status TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS min_stock_alert INT DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica inventory_items" ON public.inventory_items;
CREATE POLICY "Lectura y escritura publica inventory_items" ON public.inventory_items FOR ALL USING (true);

-- 5. Tabla de Órdenes de Trabajo Kanban & Historial (Taller)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id TEXT PRIMARY KEY,
    vehicle_plate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pagado_autorizado',
    assigned_technician_id TEXT,
    problem_description TEXT,
    diagnostic_notes TEXT,
    observations TEXT,
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_time TIMESTAMP WITH TIME ZONE,
    items JSONB DEFAULT '[]'::jsonb,
    quinquennial_date TEXT,
    chip_expiry_date TEXT,
    vehicle_type TEXT,
    general_maintenance_service TEXT,
    spare_parts_services TEXT,
    requires_certification BOOLEAN DEFAULT FALSE,
    certification_type TEXT,
    certification_price NUMERIC(10,2) DEFAULT 0,
    allow_modifications BOOLEAN DEFAULT FALSE
);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pagado_autorizado';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS assigned_technician_id TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS problem_description TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS diagnostic_notes TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS completion_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS quinquennial_date TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS chip_expiry_date TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS general_maintenance_service TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS spare_parts_services TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS requires_certification BOOLEAN DEFAULT FALSE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS certification_type TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS certification_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS allow_modifications BOOLEAN DEFAULT FALSE;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica work_orders" ON public.work_orders;
CREATE POLICY "Lectura y escritura publica work_orders" ON public.work_orders FOR ALL USING (true);

-- 6. Tabla de Citas Online & Reservas (Recepción)
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    plate TEXT NOT NULL,
    service_type TEXT NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica appointments" ON public.appointments;
CREATE POLICY "Lectura y escritura publica appointments" ON public.appointments FOR ALL USING (true);

-- 7. Tabla de Facturas, Boletas & Cobros (Caja)
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    client_name TEXT NOT NULL,
    customer_doc TEXT,
    customer_address TEXT,
    labor_fee NUMERIC(10,2) DEFAULT 0,
    parts_total NUMERIC(10,2) DEFAULT 0,
    certification_fee NUMERIC(10,2) DEFAULT 0,
    grand_total NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pagado',
    payment_method TEXT DEFAULT 'Efectivo',
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    receipt_number TEXT,
    receipt_type TEXT,
    discounts TEXT,
    credit_amount NUMERIC(10,2) DEFAULT 0,
    raw_price_str TEXT,
    raw_credit_str TEXT,
    payment_condition TEXT,
    payment_destination TEXT,
    observations TEXT
);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_doc TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS labor_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parts_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS certification_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pagado';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Efectivo';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS receipt_type TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discounts TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_price_str TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_credit_str TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_condition TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_destination TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica invoices" ON public.invoices;
CREATE POLICY "Lectura y escritura publica invoices" ON public.invoices FOR ALL USING (true);

-- 8. Tabla de Certificaciones (Certificadora)
CREATE TABLE IF NOT EXISTS public.certifications (
    id TEXT PRIMARY KEY,
    work_order_id TEXT,
    vehicle_plate TEXT NOT NULL,
    client_name TEXT,
    client_phone TEXT,
    chip_code TEXT,
    cylinder_serial TEXT,
    certification_type TEXT NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'aprobado',
    price NUMERIC(10,2) DEFAULT 80,
    is_ready BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS chip_code TEXT;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS cylinder_serial TEXT;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aprobado';
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 80;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT TRUE;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica certifications" ON public.certifications;
CREATE POLICY "Lectura y escritura publica certifications" ON public.certifications FOR ALL USING (true);

-- 9. Tabla de Programación & Vencimientos 90 Días
CREATE TABLE IF NOT EXISTS public.schedule_records (
    id TEXT PRIMARY KEY,
    vehicle_plate TEXT NOT NULL,
    client_name TEXT,
    client_phone TEXT,
    current_mileage INT DEFAULT 0,
    service_date TEXT,
    service_name TEXT,
    expiry_quinquennial TEXT,
    expiry_chip_annual TEXT,
    next_maintenance_date TEXT,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'programado',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS current_mileage INT DEFAULT 0;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS service_date TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS expiry_quinquennial TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS expiry_chip_annual TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS next_maintenance_date TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'programado';
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.schedule_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.schedule_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica schedule_records" ON public.schedule_records;
CREATE POLICY "Lectura y escritura publica schedule_records" ON public.schedule_records FOR ALL USING (true);
