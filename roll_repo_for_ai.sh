#!/usr/bin/env bash
# roll_repo_for_ai.sh — Interactive tree selection + SAFE CLEAN + base64 stripping
set -uo pipefail

export TERM="${TERM:-xterm}"

safe_clear() { clear 2>/dev/null || true; }
safe_tput()   { tput "$@" 2>/dev/null || true; }

REPO_DIR="${1:-.}"
MAX_SIZE_KB="${2:-40}"
MAX_SIZE_BYTES=$((MAX_SIZE_KB * 1024))
OUT_DIR="rolled_repo"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; WHITE='\033[1;37m'
DIM='\033[2m'; NC='\033[0m'; BOLD='\033[1m'

declare -A SELECTED
declare -a TREE_ITEMS TREE_PATHS TREE_DEPTHS TREE_TYPES
CURSOR=0

cd "$REPO_DIR"
mkdir -p "$OUT_DIR"

get_files() {
    git ls-files --cached --others --exclude-standard | \
        grep -vE '(\.lock$|bun\.lockb|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)' | \
        grep -vE '(^\.env$|\.env\..*)' | \
        grep -vE '(^\.git/|\.next/|\.cache/)' | \
        grep -vE '(node_modules/|dist/|build/|out/|coverage/|public/)' | \
        grep -vE '(^|/)(target|vendor|zig-(cache|out))(/|$)' | \
        grep -vE '\.(exe|dll|so|dylib|a|o|obj|lib|pdb|ilk|exp|wasm|elf)(\..+)?$' | \
        grep -vE '\.(svelte\.(js|ts|jsx|tsx)|d\.ts)$' | \
        sort
}

build_tree() {
    local files="$1"
    declare -A dirs_added

    TREE_ITEMS=(); TREE_PATHS=(); TREE_DEPTHS=(); TREE_TYPES=()

    while IFS= read -r file; do
        [[ -z "$file" ]] && continue

        local dir_path=""
        IFS='/' read -ra parts <<< "$file"
        local depth=0

        for ((i=0; i<${#parts[@]}-1; i++)); do
            dir_path="${dir_path:+$dir_path/}${parts[i]}"
            if [[ -z "${dirs_added[$dir_path]:-}" ]]; then
                dirs_added[$dir_path]=1
                TREE_ITEMS+=("${parts[i]}")
                TREE_PATHS+=("$dir_path")
                TREE_DEPTHS+=($depth)
                TREE_TYPES+=("dir")
                SELECTED["$dir_path"]=1
            fi
            ((depth++))
        done

        TREE_ITEMS+=("${parts[-1]}")
        TREE_PATHS+=("$file")
        TREE_DEPTHS+=($depth)
        TREE_TYPES+=("file")
        SELECTED["$file"]=1

    done <<< "$files"
}

toggle_selection() {
    local idx=$1
    local path="${TREE_PATHS[$idx]}"
    local type="${TREE_TYPES[$idx]}"

    if [[ "${SELECTED[$path]:-0}" == "1" ]]; then
        SELECTED["$path"]=0
        if [[ "$type" == "dir" ]]; then
            for ((i=0; i<${#TREE_PATHS[@]}; i++)); do
                [[ "${TREE_PATHS[$i]}" == "$path/"* ]] && \
                  SELECTED["${TREE_PATHS[$i]}"]=0
            done
        fi
    else
        SELECTED["$path"]=1
        if [[ "$type" == "dir" ]]; then
            for ((i=0; i<${#TREE_PATHS[@]}; i++)); do
                [[ "${TREE_PATHS[$i]}" == "$path/"* ]] && \
                  SELECTED["${TREE_PATHS[$i]}"]=1
            done
        fi
        local parent_path="$path"
        while [[ "$parent_path" == */* ]]; do
            parent_path="${parent_path%/*}"
            SELECTED["$parent_path"]=1
        done
    fi
}

get_term_height() { safe_tput lines || echo 24; }

draw_tree() {
    local term_height=$(get_term_height)
    local visible_height=$((term_height - 10))
    local total=${#TREE_ITEMS[@]}

    local scroll_offset=0
    ((CURSOR >= visible_height)) && scroll_offset=$((CURSOR - visible_height + 1))

    safe_clear
    echo -e "${BOLD}${CYAN}           🤖 Roll Repo For AI 🤖${NC}"
    echo -e "${DIM}=============================================${NC}"
    echo -e "${WHITE}Select files/folders to include:${NC}"
    echo -e "${DIM}↑/↓: Navigate | Space: Toggle | a: All | n: None | \
Enter: Confirm${NC}"
    echo -e "${DIM}=============================================${NC}"
    echo ""

    local visible_count=0
    for ((i=scroll_offset; i<total && visible_count<visible_height; i++)); do
        local item="${TREE_ITEMS[$i]}"
        local path="${TREE_PATHS[$i]}"
        local depth="${TREE_DEPTHS[$i]}"
        local type="${TREE_TYPES[$i]}"
        local selected="${SELECTED[$path]:-0}"

        local indent=""
        for ((d=0; d<depth; d++)); do indent+="   "; done

        local checkbox
        [[ "$selected" == "1" ]] && checkbox="${GREEN}[X]${NC}" || \
          checkbox="${DIM}[ ]${NC}"

        local icon
        [[ "$type" == "dir" ]] && icon="${YELLOW}📁${NC}" || \
          icon="${BLUE}📄${NC}"

        if ((i == CURSOR)); then
            echo -e "${WHITE}▶${NC} ${checkbox} ${indent}${icon} \
${BOLD}${item}${NC}"
        else
            echo -e "  ${checkbox} ${indent}${icon} ${item}"
        fi
        ((visible_count++))
    done

    echo ""
    echo -e "${DIM}─────────────────────────────────────────────${NC}"

    local selected_files=0 total_files=0
    for ((i=0; i<${#TREE_TYPES[@]}; i++)); do
        [[ "${TREE_TYPES[$i]}" == "file" ]] && ((total_files++))
        [[ "${TREE_TYPES[$i]}" == "file" && \
           "${SELECTED[${TREE_PATHS[$i]}]:-0}" == "1" ]] && \
          ((selected_files++))
    done

    echo -e "${GREEN}Selected: ${selected_files}/${total_files} files${NC}  |  \
${DIM}Item $((CURSOR+1))/${total}${NC}"
}

tree_select() {
    local files
    files=$(get_files)
    build_tree "$files"

    safe_tput civis
    trap 'tput cnorm 2>/dev/null; stty sane 2>/dev/null' EXIT

    while true; do
        draw_tree
        IFS= read -rsn1 key
        case "$key" in
            $'\x1b') read -rsn2 -t 0.1 key2
                     case "$key2" in
                         '[A') ((CURSOR>0)) && ((CURSOR--)) ;;
                         '[B') ((CURSOR<${#TREE_ITEMS[@]}-1)) && \
                           ((CURSOR++)) ;;
                     esac ;;
            ' ') toggle_selection $CURSOR ;;
            'a'|'A') for path in "${TREE_PATHS[@]}"; do \
              SELECTED["$path"]=1; done ;;
            'n'|'N') for path in "${TREE_PATHS[@]}"; do \
              SELECTED["$path"]=0; done ;;
            ''|$'\n') safe_tput cnorm; break ;;
            'q'|'Q') safe_tput cnorm; echo; echo "Cancelled."; exit 0 ;;
        esac
    done

    SELECTED_FILES=""
    for ((i=0; i<${#TREE_PATHS[@]}; i++)); do
        [[ "${TREE_TYPES[$i]}" == "file" && \
           "${SELECTED[${TREE_PATHS[$i]}]:-0}" == "1" ]] &&
            SELECTED_FILES+="${TREE_PATHS[$i]}"$'\n'
    done
}

progress() {
    local current=$1 total=$2 file=$3
    local pct=$((current * 100 / total))
    local bar_width=30
    local filled=$((pct * bar_width / 100))
    local empty=$((bar_width - filled))
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    local max_name=30
    local display_file="$file"
    ((${#file} > max_name)) && display_file="...${file: -$((max_name-3))}"
    printf "\r\033[K${GREEN}[%s]${NC} %3d%% │ ${DIM}%s${NC}" "$bar" "$pct" \
      "$display_file"
}

clean_file_for_ai() {
    local f="$1"
    local ext="${f##*.}"
    local content
    content="$(sed -e 's/\/\/.*$//' -e 's/#.*$//' -e '/\/\*/,/\*\//d' \
                   -e 's/[[:space:]]\+/ /g' -e 's/^[ \t]*//' \
                   -e 's/[ \t]*$//' "$f" 2>/dev/null | sed '/^$/d')"
    [[ "$ext" != "css" ]] &&
        content="$(echo "$content" | \
          sed 's/data:[a-zA-Z0-9\/+;=,.%-]*base64,[a-zA-Z0-9\/+=]*//g')"
    echo "$content" | fold -s -w 200
}

run_text() {
    local files="$1"
    local part=1
    local out="$OUT_DIR/ai_context_${part}.txt"
    echo "" > "$out"
    local total=$(echo "$files" | grep -c . || echo 0)
    local count=0

    echo ""
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        ((count++))
        progress $count $total "$f"
        [[ -f "$f" ]] || continue
        file "$f" 2>/dev/null | grep -qi binary && continue

        header="===== FILE: $f ====="
        content="$(clean_file_for_ai "$f")"

        local current_size
        current_size=$(stat -f%z "$out" 2>/dev/null || \
          stat -c%s "$out" 2>/dev/null || echo 0)
        if (( current_size + ${#header} > MAX_SIZE_BYTES )); then
            ((part++))
            out="$OUT_DIR/ai_context_${part}.txt"
            echo "" > "$out"
        fi

        echo "$header" >> "$out"
        echo "$content" >> "$out"
        echo "" >> "$out"
    done <<< "$files"

    echo ""; echo ""
    echo -e "${GREEN}✓ Created ${part} file(s) in ${OUT_DIR}/${NC}"
}

run_sh() {
    local files="$1"
    local part=1
    local out="$OUT_DIR/ai_restore_${part}.sh"
    init() {
        echo "#!/bin/bash" > "$out"
        echo "# RESTORE SCRIPT PART $part" >> "$out"
        echo "" >> "$out"
        chmod +x "$out"
    }
    init
    local total=$(echo "$files" | grep -c . || echo 0)
    local count=0

    echo ""
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        ((count++))
        progress $count $total "$f"
        [[ -f "$f" ]] || continue
        file "$f" 2>/dev/null | grep -qi binary && continue

        d="EOF_$(echo "$f" | md5sum | cut -c1-6)"
        header="mkdir -p \"$(dirname "$f")\" && cat << '$d' > \"$f\""

        local current_size
        current_size=$(stat -f%z "$out" 2>/dev/null || \
          stat -c%s "$out" 2>/dev/null || echo 0)
        if (( current_size + ${#header} > MAX_SIZE_BYTES )); then
            ((part++))
            out="$OUT_DIR/ai_restore_${part}.sh"
            init
        fi

        echo "$header" >> "$out"
        cat "$f" >> "$out"
        echo "$d" >> "$out"
        echo "" >> "$out"
    done <<< "$files"

    echo ""; echo ""
    echo -e "${GREEN}✓ Created ${part} restore script(s) in ${OUT_DIR}/${NC}"
}

main_menu() {
    safe_clear
    echo -e "${BOLD}${CYAN}           🤖 Roll Repo For AI 🤖${NC}"
    echo -e "${DIM}==============================================${NC}"
    echo ""
    echo -e "  ${WHITE}1)${NC} Roll AI Version ${DIM}(.txt minimal - most \
common)${NC}"
    echo ""
    echo -e "  ${WHITE}2)${NC} Pick files from tree view ${DIM}(interactive \
select)${NC}"
    echo ""
    echo -e "  ${WHITE}3)${NC} Roll Restorable Version ${DIM}(.sh heredoc - \
large)${NC}"
    echo ""
    echo -e "${DIM}==============================================${NC}"
    echo ""
    read -p "Select mode [1, 2, or 3]: " MODE

    case "$MODE" in
        1)  echo ""; echo -e "${CYAN}Rolling all files to AI-ready \
text...${NC}"
            FILES=$(get_files)
            run_text "$FILES" ;;
        2)  tree_select
            if [[ -n "$SELECTED_FILES" ]]; then
                safe_clear; echo -e "${CYAN}Rolling selected files to \
AI-ready text...${NC}"
                run_text "$SELECTED_FILES"
            else
                echo "No files selected."
            fi ;;
        3)  echo ""; echo -e "${CYAN}Rolling all files to restore \
scripts...${NC}"
            FILES=$(get_files)
            run_sh "$FILES" ;;
        *)  echo -e "${RED}Invalid selection${NC}"; exit 1 ;;
    esac
}

main_menu
