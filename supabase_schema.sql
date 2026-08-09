-- =========================================================================
-- REYGAS AUTOGAS EQUIPMENT - SCRIPT DE BASE DE DATOS SUPABASE POSTGRESQL
-- Ejecutar este script en el SQL Editor de tu panel de Supabase
-- =========================================================================

-- 1. Tabla de Contenido Dinámico CMS (Sitio Web Público)
CREATE TABLE IF NOT EXISTS public.site_content (
    section_key TEXT PRIMARY KEY,
    content JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica site_content" ON public.site_content FOR ALL USING (true);

-- 2. Tabla de Técnicos (ERP Taller)
CREATE TABLE IF NOT EXISTS public.technicians (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica technicians" ON public.technicians FOR ALL USING (true);

-- 3. Tabla de Inventario de Insumos & Repuestos (Almacén)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY,
    sku_barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    stock_quantity INT DEFAULT 0,
    unit_price NUMERIC(10,2) DEFAULT 0,
    min_stock_alert INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica inventory_items" ON public.inventory_items FOR ALL USING (true);

-- 4. Tabla de Órdenes de Trabajo Kanban (Taller)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id TEXT PRIMARY KEY,
    vehicle_plate TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_technician_id TEXT,
    problem_description TEXT,
    diagnostic_notes TEXT,
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    items JSONB DEFAULT '[]'::jsonb
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica work_orders" ON public.work_orders FOR ALL USING (true);

-- 5. Tabla de Citas Online & Reservas (Recepción)
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    plate TEXT NOT NULL,
    service_type TEXT NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente',
    notes TEXT
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica appointments" ON public.appointments FOR ALL USING (true);

-- 6. Tabla de Facturas & Cobros (Caja)
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    client_name TEXT NOT NULL,
    labor_fee NUMERIC(10,2) DEFAULT 0,
    parts_total NUMERIC(10,2) DEFAULT 0,
    certification_fee NUMERIC(10,2) DEFAULT 0,
    grand_total NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pendiente',
    payment_method TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura y escritura publica invoices" ON public.invoices FOR ALL USING (true);
