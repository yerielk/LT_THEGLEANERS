"""
Lecta (THE GLEANERS) system architecture, drawn as code with mingrammer/diagrams.

Render (needs Graphviz: `brew install graphviz`):

    uv run --with diagrams==0.25.1 python docs/architecture/architecture.py

Writes lecta_architecture.png next to this file.
Edge colours: blue = web flow, red = agent / MCP flow, grey = data.
"""
from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.generic.database import SQL
from diagrams.onprem.client import Client, User
from diagrams.onprem.network import Internet
from diagrams.onprem.security import Vault
from diagrams.programming.framework import NextJs, React
from diagrams.programming.language import Nodejs, TypeScript

OUT = Path(__file__).with_name("lecta_architecture")

WEB = "#1c4286"    # Deep Lyons Blue (Wada)
AGENT = "#c55347"  # Etruscan Red (Wada)
DATA = "#6b6b6b"

# curved edges keep labels attached to their lines (ortho routing lets them drift)
graph_attr = {"fontsize": "22", "pad": "0.6", "nodesep": "0.8", "ranksep": "1.2", "labelloc": "t", "splines": "spline"}

with Diagram("Lecta — architecture (feat/uat-editorial-mcp)", filename=str(OUT), show=False, direction="LR", graph_attr=graph_attr):
    with Cluster("Clients"):
        curator = User("Curator\n(browser)")
        agent = TypeScript("agent:demo\nscripts/agent-demo.ts")
        inspector = Client("MCP Inspector\n:6274")
        smoke = TypeScript("mcp:smoke\nscripts/mcp-smoke.ts")

    with Cluster("External services"):
        claude = Internet("Anthropic API\nClaude · tool use")
        media = Internet("Wikimedia artwork\nGoogle Fonts · jsDelivr")

    with Cluster("Local machine  127.0.0.1"):
        with Cluster("Next.js 16 app  :3000"):
            pages = React("App Router pages\nhome · discover · works\nexhibitions · me · agent-lab")
            api = NextJs("REST API  /api/*\nworks · exhibitions\nrecommendations")
            lab = NextJs("/api/agent-lab/\nprotocol-test")

        with Cluster("MCP server  :3333/mcp  (Streamable HTTP)"):
            mcp = Nodejs("mcp/server.ts\nMcpServer per request")
            tools = TypeScript("mcp/tools.ts\n4 read tools\n1 write tool")
            gate = Vault("write gate\nBearer key +\napprovedByHuman")

        with Cluster("Shared core  src/lib"):
            services = TypeScript("services/\nworks · exhibitions · actor\n+ zod validators")
            engine = TypeScript("recommendation/engine.ts\ncoldstart-v1")

        db = SQL("SQLite  data/lecta.db\nnode:sqlite · WAL\nworks · exhibitions\nrecommendation_events\nagent_activity")
        seed = TypeScript("npm run db:setup\ncatalog.ts → seed")

    # web flow
    curator >> Edge(color=WEB, label="HTTP") >> pages
    curator >> Edge(color=WEB, style="dashed", label="images · fonts") >> media
    pages >> Edge(color=WEB, label="fetch") >> api
    pages >> Edge(color=WEB) >> lab
    api >> Edge(color=WEB) >> services
    api >> Edge(color=WEB, label="same engine") >> engine

    # agent / MCP flow
    agent >> Edge(color=AGENT, label="messages.create") >> claude
    agent >> Edge(color=AGENT, label="tools/list · tools/call\nBearer key") >> mcp
    inspector >> Edge(color=AGENT, style="dashed") >> mcp
    smoke >> Edge(color=AGENT, style="dashed") >> mcp
    lab >> Edge(color=AGENT, style="dashed", label="MCP client\n(read-only)") >> mcp
    mcp >> Edge(color=AGENT) >> tools
    tools >> Edge(color=AGENT, style="dashed", label="create_exhibition_draft") >> gate
    gate >> Edge(color=AGENT) >> services
    tools >> Edge(color=AGENT) >> services
    tools >> Edge(color=AGENT, label="same engine") >> engine

    # data
    services >> Edge(color=DATA) >> db
    engine >> Edge(color=DATA, label="EXPOSED events") >> db
    tools >> Edge(color=DATA, style="dotted", label="agent_activity") >> db
    seed >> Edge(color=DATA, style="dashed") >> db
