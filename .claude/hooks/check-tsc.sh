#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): roda "tsc -b" quando um .ts/.tsx é tocado,
# para pegar erro de tipo na hora em vez de só no build. Ver CLAUDE.md.
# Usa node em vez de jq porque jq nem sempre está disponível no Git Bash
# do Windows, e node já é garantido neste projeto (é um repo npm).
REPO="c:/Users/Luna/Documents/GitHub/gestaocontratos"

FILE=$(node -e '
let d="";
process.stdin.on("data",c=>d+=c);
process.stdin.on("end",()=>{
  try {
    const j = JSON.parse(d);
    process.stdout.write((j.tool_input && j.tool_input.file_path) || "");
  } catch (e) {}
});
')

case "$FILE" in
  *.ts|*.tsx)
    OUT=$(cd "$REPO" && npx tsc -b 2>&1)
    if [ $? -ne 0 ]; then
      node -e '
      let d="";
      process.stdin.on("data",c=>d+=c);
      process.stdin.on("end",()=>{
        process.stdout.write(JSON.stringify({decision:"block",reason:d}));
      });
      ' <<< "$OUT"
    fi
    ;;
esac
