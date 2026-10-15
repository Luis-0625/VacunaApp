-- Estado real de entrega de los WhatsApp. Idempotente: se puede ejecutar varias veces.
--
-- Twilio acepta el mensaje y después avisa si se entregó o falló (/api/whatsapp/estado). Para saber a qué
-- recordatorios corresponde cada aviso se guarda el id del mensaje (SID de Twilio). Un mismo mensaje puede
-- cubrir varios recordatorios (varias dosis del mismo teléfono).
alter table recordatorios add column if not exists whatsapp_sid text;
create index if not exists recordatorios_whatsapp_sid_idx on recordatorios (whatsapp_sid) where whatsapp_sid is not null;

notify pgrst, 'reload schema';
