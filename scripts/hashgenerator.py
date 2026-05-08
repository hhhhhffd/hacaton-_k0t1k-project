"""
Утилита для генерации bcrypt-хешей паролей.

Использование:
    # Интерактивный режим (скрытый ввод пароля):
    python scripts/hashgenerator.py

    # Хеш одного пароля напрямую:
    python scripts/hashgenerator.py --password "mypassword"

    # Несколько паролей через файл (один пароль в строке):
    python scripts/hashgenerator.py --file passwords.txt

    # SQL-INSERT для прямой вставки в БД:
    python scripts/hashgenerator.py --password "mypassword" --sql --email admin@example.com

    # Проверить пароль против хеша:
    python scripts/hashgenerator.py --verify --password "mypassword" --hash '$2b$12$...'
"""

import argparse
import getpass
import sys

try:
    import bcrypt
except ImportError:
    print("Установите bcrypt: pip install bcrypt==4.2.0")
    sys.exit(1)

ROUNDS = 12  # Cost factor — совпадает с backend/app/core/auth.py


def make_hash(password: str) -> str:
    """Генерирует bcrypt-хеш с rounds=12."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=ROUNDS)).decode("utf-8")


def check_hash(password: str, hashed: str) -> bool:
    """Проверяет пароль против хеша."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def process_single(password: str, sql: bool, email: str | None) -> None:
    hashed = make_hash(password)
    print(f"\nПароль : {password}")
    print(f"Хеш    : {hashed}")
    print(f"Rounds : {ROUNDS}")
    if sql:
        em = email or "user@example.com"
        print("\n— SQL UPDATE (установить пароль существующему пользователю) —")
        print(f"UPDATE users SET hashed_password = '{hashed}' WHERE email = '{em}';")
        print("\n— SQL INSERT (создать пользователя-администратора) —")
        print(
            f"INSERT INTO users (email, hashed_password, full_name, is_active, is_admin, auth_provider)\n"
            f"VALUES ('{em}', '{hashed}', 'Admin', TRUE, TRUE, 'local');"
        )


def process_file(path: str) -> None:
    try:
        with open(path, encoding="utf-8") as f:
            passwords = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Файл не найден: {path}")
        sys.exit(1)

    print(f"\nОбрабатываем {len(passwords)} паролей (rounds={ROUNDS})...\n")
    print(f"{'ПАРОЛЬ':<30}  ХЕШ")
    print("-" * 90)
    for pwd in passwords:
        hashed = make_hash(pwd)
        print(f"{pwd:<30}  {hashed}")


def interactive_mode() -> None:
    print("=== bcrypt Hash Generator (rounds=12) ===")
    try:
        password = getpass.getpass("Введите пароль: ")
        if not password:
            print("Пароль не может быть пустым.")
            sys.exit(1)
        confirm = getpass.getpass("Повторите пароль: ")
    except KeyboardInterrupt:
        print("\nОтменено.")
        sys.exit(0)

    if password != confirm:
        print("Пароли не совпадают.")
        sys.exit(1)

    hashed = make_hash(password)
    print(f"\nХеш: {hashed}")
    print(f"Rounds: {ROUNDS}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Генератор bcrypt-хешей для k0t1k Project",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--password", "-p", help="Пароль в открытом виде")
    parser.add_argument("--file", "-f", help="Файл с паролями (один пароль на строку)")
    parser.add_argument("--sql", action="store_true", help="Вывести SQL-запросы для вставки в БД")
    parser.add_argument("--email", "-e", help="Email для SQL-запроса (с --sql)")
    parser.add_argument("--verify", action="store_true", help="Режим проверки пароля против хеша")
    parser.add_argument("--hash", help="Хеш для проверки (с --verify)")
    parser.add_argument("--rounds", type=int, default=ROUNDS, help=f"Cost factor bcrypt (по умолчанию {ROUNDS})")
    args = parser.parse_args()

    # Режим проверки пароля
    if args.verify:
        if not args.password or not args.hash:
            print("Укажите --password и --hash для проверки.")
            sys.exit(1)
        ok = check_hash(args.password, args.hash)
        print(f"\nПароль {'✓ ВЕРНЫЙ' if ok else '✗ НЕВЕРНЫЙ'}")
        sys.exit(0 if ok else 1)

    # Режим файла
    if args.file:
        process_file(args.file)
        return

    # Режим одного пароля
    if args.password:
        process_single(args.password, args.sql, args.email)
        return

    # Интерактивный режим
    interactive_mode()


if __name__ == "__main__":
    main()
