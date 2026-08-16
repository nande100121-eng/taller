-- =========================================================================
-- REYGAS AUTOGAS EQUIPMENT - SCRIPT COMPLETO DE BASE DE DATOS SUPABASE POSTGRESQL
-- Ejecutar este script en el SQL Editor de tu panel de Supabase (https://app.supabase.com)
-- para habilitar todas las tablas y eliminar los errores 404.
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
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica invoices" ON public.invoices FOR ALL USING (true);

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
ALTER TABLE public.schedule_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica schedule_records" ON public.schedule_records;
CREATE POLICY "Lectura y escritura publica schedule_records" ON public.schedule_records FOR ALL USING (true);
