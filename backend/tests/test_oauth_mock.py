from app.utils import encrypt, decrypt


def test_encrypt_roundtrip():
    secret = "mytoken"
    mk = "masterkey"
    enc = encrypt(secret, mk)
    dec = decrypt(enc, mk)
    assert dec == secret
