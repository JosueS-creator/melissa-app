import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-melissa-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "https://danelilabs.lat";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Push service is not configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cronToken = req.headers.get("x-melissa-cron-secret") || "";
  const { data: autorizado, error: errorAuth } = await supabase.rpc(
    "validar_melissa_push_cron",
    { p_token: cronToken },
  );
  if (errorAuth || autorizado !== true) return json({ error: "Unauthorized" }, 401);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const ahora = Date.now();
  const ventanas = [
    { tipo: "24h", milisegundos: 24 * 60 * 60 * 1000 },
    { tipo: "2h", milisegundos: 2 * 60 * 60 * 1000 },
  ];
  const resumen = { revisadas: 0, enviadas: 0, fallidas: 0, sinSuscripcion: 0 };

  for (const ventana of ventanas) {
    // La ventana de diez minutos tolera retrasos puntuales del cron.
    const desde = new Date(ahora + ventana.milisegundos - 10 * 60 * 1000).toISOString();
    const hasta = new Date(ahora + ventana.milisegundos).toISOString();
    const { data: citas, error: errorCitas } = await supabase
      .from("citas")
      .select("id, clinica_id, paciente_id, fecha_hora, estado")
      .eq("estado", "confirmada")
      .gte("fecha_hora", desde)
      .lte("fecha_hora", hasta);

    if (errorCitas) {
      console.error("Error consultando citas", errorCitas);
      continue;
    }

    for (const cita of citas || []) {
      resumen.revisadas++;
      const [{ data: paciente }, { data: clinica }] = await Promise.all([
        supabase.from("pacientes")
          .select("id, nombre, perfil_id, clinica_id")
          .eq("id", cita.paciente_id).maybeSingle(),
        supabase.from("clinicas")
          .select("nombre")
          .eq("id", cita.clinica_id).maybeSingle(),
      ]);

      if (!paciente?.perfil_id || paciente.clinica_id !== cita.clinica_id) continue;

      const { data: perfil } = await supabase.from("perfiles")
        .select("recordatorios_citas")
        .eq("id", paciente.perfil_id)
        .maybeSingle();
      if (!perfil?.recordatorios_citas) continue;

      const { data: suscripciones, error: errorSubs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, subscription")
        .eq("user_id", paciente.perfil_id)
        .eq("patient_id", paciente.id)
        .eq("clinic_id", cita.clinica_id);

      if (errorSubs) {
        console.error("Error consultando suscripciones", errorSubs);
        continue;
      }
      if (!suscripciones?.length) {
        resumen.sinSuscripcion++;
        continue;
      }

      for (const suscripcion of suscripciones) {
        const { data: previo } = await supabase.from("push_reminder_deliveries")
          .select("id, status, attempts")
          .eq("cita_id", cita.id)
          .eq("subscription_id", suscripcion.id)
          .eq("reminder_type", ventana.tipo)
          .maybeSingle();

        if (previo?.status === "sent" || (previo && previo.attempts >= 3)) continue;

        let deliveryId = previo?.id;
        const intentos = (previo?.attempts || 0) + 1;
        if (previo) {
          const { error } = await supabase.from("push_reminder_deliveries")
            .update({ status: "processing", attempts: intentos, error: null })
            .eq("id", previo.id);
          if (error) continue;
        } else {
          const { data: nuevo, error } = await supabase.from("push_reminder_deliveries")
            .insert({
              cita_id: cita.id,
              subscription_id: suscripcion.id,
              reminder_type: ventana.tipo,
              status: "processing",
              attempts: 1,
            })
            .select("id")
            .maybeSingle();
          if (error || !nuevo) continue;
          deliveryId = nuevo.id;
        }

        const payload = JSON.stringify({
          title: clinica?.nombre || "Melissa",
          body: "Recuerda que tienes una cita próxima. Abre Melissa para consultar los detalles.",
          fechaHora: cita.fecha_hora,
          url: "/",
          tag: `cita-${cita.id}-${ventana.tipo}`,
        });

        try {
          await webpush.sendNotification(suscripcion.subscription, payload);
          await supabase.from("push_reminder_deliveries")
            .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
            .eq("id", deliveryId);
          resumen.enviadas++;
        } catch (error) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", suscripcion.id);
          }
          await supabase.from("push_reminder_deliveries")
            .update({ status: "failed", error: String(error).slice(0, 1000) })
            .eq("id", deliveryId);
          resumen.fallidas++;
        }
      }
    }
  }

  return json(resumen, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
