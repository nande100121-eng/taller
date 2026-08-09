-- =====================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS PARA REYGAS AUTOGAS EQUIPMENT
-- PostgreSQL / Supabase
-- =====================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMERACIONES (TIPOS DE DATOS REGISTRADOS)
CREATE TYPE user_role AS ENUM ('admin', 'personal');
CREATE TYPE vehicle_fuel_type AS ENUM ('GNV', 'GLP', 'Gasolina', 'Bifuel');
CREATE TYPE work_order_status AS ENUM ('ingresado', 'en_diagnostico', 'esperando_repuestos', 'en_servicio', 'por_cobrar', 'pagado_autorizado', 'finalizado');
CREATE TYPE payment_status AS ENUM ('pendiente', 'pagado');
CREATE TYPE appointment_status AS ENUM ('pendiente', 'confirmado', 'completado', 'cancelado');
CREATE TYPE tool_loan_status AS ENUM ('prestado', 'devuelto', 'mantenimiento');

-- 2. TABLA DE PERFILES (AUTH & USUARIOS)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role DEFAULT 'personal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE CMS DINÁMICO (SITIO WEB Y PARÁMETROS GLOBALES)
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MAESTRO DE TÉCNICOS (REGISTRO DINÁMICO DE MECÁNICOS Y OPERARIOS)
CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE VEHÍCULOS
CREATE TABLE IF NOT EXISTS vehicles (
  plate TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  color TEXT,
  fuel_type vehicle_fuel_type DEFAULT 'GNV',
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  current_mileage INT DEFAULT 0,
  last_visit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA DE ORDENES DE TRABAJO (OT)
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_plate TEXT NOT NULL REFERENCES vehicles(plate) ON DELETE CASCADE,
  status work_order_status DEFAULT 'ingresado',
  assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  problem_description TEXT NOT NULL,
  diagnostic_notes TEXT,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completion_time TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id)
);

-- 7. TABLA DE CATÁLOGO DE INVENTARIO Y REPUESTOS
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Repuestos GNV/GLP',
  stock_quantity INT DEFAULT 0,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  min_stock_alert INT DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ITEMES Y REQUISICIONES DE ORDENES DE TRABAJO
CREATE TABLE IF NOT EXISTS work_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  technician_id UUID REFERENCES technicians(id),
  dispatched BOOLEAN DEFAULT FALSE
);

-- 9. CONTROL Y PRÉSTAMO DE HERRAMIENTAS EN ALMACÉN
CREATE TABLE IF NOT EXISTS tool_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_name TEXT NOT NULL,
  serial_number TEXT,
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  returned_at TIMESTAMP WITH TIME ZONE,
  status tool_loan_status DEFAULT 'prestado',
  notes TEXT
);

-- 10. FACTURACIÓN Y COMPROBANTES
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  labor_fee NUMERIC(10, 2) DEFAULT 0.00,
  parts_total NUMERIC(10, 2) DEFAULT 0.00,
  certification_fee NUMERIC(10, 2) DEFAULT 0.00,
  grand_total NUMERIC(10, 2) NOT NULL,
  payment_status payment_status DEFAULT 'pendiente',
  payment_method TEXT DEFAULT 'Efectivo',
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. CITAS Y RESERVAS WEB
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  plate TEXT NOT NULL,
  service_type TEXT NOT NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status appointment_status DEFAULT 'pendiente',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. CERTIFICACIONES GNV / GLP
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_plate TEXT NOT NULL REFERENCES vehicles(plate) ON DELETE CASCADE,
  chip_code TEXT,
  cylinder_serial TEXT,
  certification_type TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status TEXT DEFAULT 'Vigente'
);

-- 13. REGISTROS BIOMÉTRICOS DE ASISTENCIA
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_name TEXT NOT NULL,
  check_time TIMESTAMP WITH TIME ZONE NOT NULL,
  log_type TEXT NOT NULL,
  source_file TEXT
);
