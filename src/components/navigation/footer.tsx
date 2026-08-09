"use client";

import React from "react";
import Link from "next/link";
import { ReyGasLogo } from "@/components/brand/logo";
import { useAppStore } from "@/lib/store/app-store";
import { Phone, Mail, MapPin, Clock, ShieldCheck, Flame, Zap } from "lucide-react";

export const Footer: React.FC = () => {
  const { siteContent } = useAppStore();
  const contact = siteContent.contact;

  return (
    <footer className="bg-reygas-dark border-t border-white/10 text-gray-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="space-y-4">
            <ReyGasLogo size="lg" />
            <p className="text-sm text-gray-400 leading-relaxed">
              Taller de precisión especializado en conversión y mantenimiento de equipos automotrices a GNV y GLP de 5ta Generación.
            </p>
            <div className="flex items-center gap-3 text-xs text-reygas-red font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Certificación Oficial MTC / Produce</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3">
              Servicios Destacados
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <Flame className="w-3.5 h-3.5 text-reygas-red" />
                Conversiones GNV 5ta Generación
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Conversiones GLP 5ta Generación
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                Mantenimiento de Inyectores & Reductores
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                Certificación Anual & Prueba Hidrostática
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3">
              Contacto Taller
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-reygas-red shrink-0" />
                <span>{contact.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-reygas-red shrink-0" />
                <span>{contact.email}</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-reygas-red shrink-0" />
                <span>{contact.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-reygas-red shrink-0" />
                <span>{contact.schedule}</span>
              </li>
            </ul>
          </div>

          {/* ERP Access */}
          <div>
            <h4 className="text-white text-base font-bold mb-4 uppercase tracking-wider border-l-2 border-reygas-red pl-3">
              Módulos del Taller
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link href="/dashboard/porteria" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Portería & Semáforo
              </Link>
              <Link href="/dashboard/recepcion" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Recepción & Citas
              </Link>
              <Link href="/dashboard/taller" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Taller Kanban
              </Link>
              <Link href="/dashboard/almacen" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Almacén & Insumos
              </Link>
              <Link href="/dashboard/caja" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Caja & Facturación
              </Link>
              <Link href="/dashboard/certificaciones" className="p-2 rounded bg-reygas-card hover:bg-reygas-surface text-gray-300 hover:text-white transition-colors">
                Certificaciones
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
          <p>© {new Date().getFullYear()} REYGAS AUTOGAS EQUIPMENT. Todos los derechos reservados.</p>
          <p className="mt-2 md:mt-0">Sistema Dinámico ERP & CMS Automotriz</p>
        </div>
      </div>
    </footer>
  );
};
