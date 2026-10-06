#!/usr/bin/env bash
# Diagnóstico de acesso a comunidadeneuma.com (filtro DNS do ISP vs problema nosso).
# Correr no Terminal (macOS/Linux) em cada rede: Wi-Fi de casa, hotspot do telemóvel.
#   bash network-diagnose.sh > neuma-diagnostico-$(date +%s).txt 2>&1
# Enviar o ficheiro .txt gerado.

HOSTS="www.comunidadeneuma.com comunidadeneuma.com neuma-app-topaz.vercel.app"

echo "### Neuma network diagnose — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "### Resolver do sistema:"
scutil --dns 2>/dev/null | awk '/nameserver\[0\]/ {print "  " $3}' | sort -u
grep -E '^nameserver' /etc/resolv.conf 2>/dev/null

for h in $HOSTS; do
  echo
  echo "================ $h"
  echo "-- DNS (resolver do ISP):"
  dig +short "$h" 2>/dev/null || nslookup "$h" 2>/dev/null | tail -n +4
  echo "-- DNS (Cloudflare 1.1.1.1):"
  dig +short "$h" @1.1.1.1 2>/dev/null || nslookup "$h" 1.1.1.1 2>/dev/null | tail -n +4

  echo "-- Certificado servido em :443 (resolver do ISP):"
  echo | openssl s_client -connect "$h:443" -servername "$h" 2>/dev/null \
    | openssl x509 -noout -issuer -subject -enddate -fingerprint -sha256 2>/dev/null \
    || echo "  (sem certificado / ligação falhou)"

  echo "-- HTTP /login:"
  curl -sS -o /dev/null -m 15 \
    -w "  status=%{http_code} ip=%{remote_ip} redirect=%{redirect_url}\n" \
    "https://$h/login" 2>&1

  ip_cf=$(dig +short "$h" @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | tail -1)
  if [ -n "$ip_cf" ]; then
    echo "-- HTTP /login forçando IP via 1.1.1.1 ($ip_cf):"
    curl -sS -o /dev/null -m 15 --resolve "$h:443:$ip_cf" \
      -w "  status=%{http_code} ip=%{remote_ip}\n" "https://$h/login" 2>&1
  fi
done

cat <<'EOF'

### Como ler
- IP do ISP fora de 64.29.17.* / 216.198.79.* -> o ISP está a desviar o DNS (filtro).
- Certificados esperados: *.comunidadeneuma.com (Let's Encrypt) e *.vercel.app
  (Google Trust Services). Outro issuer -> página de bloqueio, não é o nosso servidor.
- "forçando IP" dá status 200  -> bloqueio só por DNS; o nosso servidor está acessível.
- vercel.app também desviado   -> bloqueio por IP / Vercel, não pelo nosso domínio.
EOF
