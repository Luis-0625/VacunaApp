-- VacunaApp - datos de prueba (ejecutar DESPUÉS de schema.sql). Se puede repetir sin duplicar.
-- Todos los documentos de prueba empiezan por 90 (ej. 9001). Para borrarlos:
--   delete from pacientes where documento_identidad like '90__';
--
-- ⚠ Las citas de "mañana" generan recordatorios PENDIENTE: si ejecutas el cron, intentará enviar
--   a estos emails/teléfonos ficticios y quedarán FALLIDO (sirve para probar "Reintentar").
--   Para recibir de verdad el mensaje, cambia email y teléfono del paciente 9001 por los tuyos
--   (ver el UPDATE comentado al final).

-- 1. Pacientes -------------------------------------------------------------
insert into pacientes (nombre_completo, documento_identidad, email, telefono, fecha_nacimiento) values
  ('María Fernanda Gómez',   '9001', 'maria.gomez@example.com',    '+573001110001', '1990-05-20'),
  ('Carlos Andrés Ruiz',     '9002', 'carlos.ruiz@example.com',    '+573001110002', '1985-03-15'),
  ('Laura Valentina Pérez',  '9003', 'laura.perez@example.com',    '+573001110003', '1998-11-02'),
  ('Juan Sebastián Torres',  '9004', 'juan.torres@example.com',    '+573001110004', '1979-07-28'),
  ('Camila Andrea Rojas',    '9005', 'camila.rojas@example.com',   '+573001110005', '2001-01-09'),
  ('Andrés Felipe Castro',   '9006', 'andres.castro@example.com',  '+573001110006', '1993-09-14'),
  ('Daniela Alejandra Mora', '9007', 'daniela.mora@example.com',   '+573001110007', '1988-12-30'),
  ('Santiago Herrera',       '9008', 'santiago.herrera@example.com','+573001110008', '2015-04-18'),
  ('Valeria Sofía Ortiz',    '9009', 'valeria.ortiz@example.com',  '+573001110009', '2019-08-05'),
  ('Miguel Ángel Vargas',    '9010', null,                         '+573001110010', '1966-02-11'),
  ('Paula Andrea Jiménez',   '9011', 'paula.jimenez@example.com',  '+573001110011', '1995-06-23'),
  ('Diego Alejandro Núñez',  '9012', 'diego.nunez@example.com',    '+573001110012', '1982-10-07'),
  ('Natalia Cruz Medina',    '9013', 'natalia.cruz@example.com',   '+573001110013', '1991-03-27'),
  ('Sergio Iván Salazar',    '9014', 'sergio.salazar@example.com', '+573001110014', '1974-09-01'),
  ('Isabella Ramírez',       '9015', 'isabella.ramirez@example.com','+573001110015', '2017-12-12'),
  ('Tomás Eduardo Linares',  '9016', 'tomas.linares@example.com',  '+573001110016', '2010-05-30'),
  ('Gabriela Montoya',       '9017', 'gabriela.montoya@example.com','+573001110017','1987-07-19'),
  ('Ricardo Alonso Peña',    '9018', 'ricardo.pena@example.com',   '+573001110018', '1959-11-25'),
  ('Sofía Carolina Duque',   '9019', 'sofia.duque@example.com',    '+573001110019', '2003-02-14'),
  ('Esteban Rincón',         '9020', 'esteban.rincon@example.com', '+573001110020', '1996-08-08')
on conflict (documento_identidad) do nothing;

-- 2. Citas (offsets en días respecto a HOY; el trigger crea los recordatorios) ---
insert into citas_vacunacion (paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, estado)
select p.id, v.id, c.dosis, current_date + c.ap, current_date + c.px, c.estado::estado_cita
from (values
  -- Dosis próximas: mañana (px = 1)
  ('9001', 'Hepatitis B',             2, -30,  1, 'COMPLETADA'),
  ('9002', 'COVID-19',                2, -28,  1, 'COMPLETADA'),
  ('9003', 'Tétanos / Difteria (Td)', 2, -30,  1, 'COMPLETADA'),
  ('9004', 'Hepatitis B',             3, -30,  1, 'COMPLETADA'),
  -- Esta semana
  ('9005', 'COVID-19',                2, -26,  2, 'COMPLETADA'),
  ('9006', 'Hepatitis B',             2, -28,  3, 'COMPLETADA'),
  ('9007', 'Tétanos / Difteria (Td)', 3, -27,  4, 'COMPLETADA'),
  ('9008', 'Hepatitis B',             2, -25,  5, 'COMPLETADA'),
  ('9009', 'COVID-19',                2, -23,  6, 'COMPLETADA'),
  ('9010', 'Hepatitis B',             2, -22,  7, 'COMPLETADA'),
  -- Más adelante
  ('9011', 'Hepatitis B',             2,  -5, 25, 'COMPLETADA'),
  ('9012', 'COVID-19',                1,  -3, 25, 'COMPLETADA'),
  ('9013', 'Tétanos / Difteria (Td)', 1,  -2, 28, 'COMPLETADA'),
  -- Historial: dosis ya vencidas (recordatorios pasados)
  ('9014', 'Hepatitis B',             2, -45, -15, 'COMPLETADA'),
  ('9015', 'COVID-19',                2, -48, -20, 'COMPLETADA'),
  ('9016', 'Tétanos / Difteria (Td)', 2, -40, -10, 'COMPLETADA'),
  ('9017', 'Hepatitis B',             3, -60, -30, 'COMPLETADA'),
  ('9018', 'COVID-19',                2, -35,  -7, 'COMPLETADA'),
  ('9019', 'Hepatitis B',             2, -33,  -3, 'COMPLETADA'),
  -- Cita cancelada (no genera recordatorio)
  ('9020', 'Influenza',               1, -10, null, 'CANCELADA')
) as c(doc, vac, dosis, ap, px, estado)
join pacientes p on p.documento_identidad = c.doc
join vacunas  v on v.nombre = c.vac
where not exists (
  select 1 from citas_vacunacion x
  where x.paciente_id = p.id and x.vacuna_id = v.id and x.numero_dosis = c.dosis
);

-- 3. Historial de recordatorios -------------------------------------------
-- Los vencidos se marcan como ENVIADO, salvo algunos FALLIDO para ver los errores.
update recordatorios r
set estado_envio = 'ENVIADO', intentos = 1, ultimo_error = null
from citas_vacunacion c join pacientes p on p.id = c.paciente_id
where r.cita_id = c.id
  and p.documento_identidad like '90__'
  and r.estado_envio = 'PENDIENTE'
  and r.fecha_programada < current_date;

update recordatorios r
set estado_envio = 'FALLIDO', intentos = 3,
    ultimo_error = 'WhatsApp: Teléfono fuera de cobertura o sin WhatsApp'
from citas_vacunacion c join pacientes p on p.id = c.paciente_id
where r.cita_id = c.id and p.documento_identidad = '9018';

update recordatorios r
set estado_envio = 'FALLIDO', intentos = 1, canal = 'EMAIL',
    ultimo_error = 'Email: El paciente no tiene un correo válido'
from citas_vacunacion c join pacientes p on p.id = c.paciente_id
where r.cita_id = c.id and p.documento_identidad = '9019';

-- Variedad de canales en los pendientes
update recordatorios r set canal = 'WHATSAPP'
from citas_vacunacion c join pacientes p on p.id = c.paciente_id
where r.cita_id = c.id and p.documento_identidad in ('9003', '9006');

update recordatorios r set canal = 'EMAIL'
from citas_vacunacion c join pacientes p on p.id = c.paciente_id
where r.cita_id = c.id and p.documento_identidad in ('9005', '9008');

-- 4. (Opcional) Recibir de verdad el recordatorio de "mañana": pon tus datos y descomenta.
-- update pacientes set email = 'TU_CORREO@gmail.com', telefono = '+57TU_CELULAR'
-- where documento_identidad = '9001';
