"""Stub health-check server. Replace with real backend when stack is chosen."""

from flask import Flask, jsonify
import os

app = Flask(__name__)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "backend-stub"})


if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", 8000))
    app.run(host="0.0.0.0", port=port)
