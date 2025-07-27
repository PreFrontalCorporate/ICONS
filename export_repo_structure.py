import os

def get_repo_structure(root_dir):
    output = ""

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Get relative path
        rel_path = os.path.relpath(dirpath, root_dir)
        rel_path = "" if rel_path == "." else rel_path

        # Folder display
        folder_display = f"/{rel_path}/" if rel_path else "/"
        output += "=" * 30 + "\n"
        output += folder_display + "\n"
        output += "=" * 30 + "\n"

        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            file_rel_path = os.path.join(rel_path, filename) if rel_path else filename

            # File header
            output += "=" * 30 + "\n"
            output += f"/{file_rel_path}\n"
            output += "=" * 30 + "\n"

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                output += content + "\n"
            except Exception as e:
                output += f"Could not read file: {file_rel_path} (Error: {e})\n"

            # Footer separator for the file
            output += "=" * 30 + "\n"

    return output

if __name__ == "__main__":
    # Change to your repo root directory if needed
    repo_path = "./"  # or "path/to/your/repo"
    save_path = "/mnt/c/icon/repo_structure.txt"

    structure_output = get_repo_structure(repo_path)

    with open(save_path, 'w', encoding='utf-8') as f:
        f.write(structure_output)

    print(f"✅ Repo structure has been saved to {save_path}")