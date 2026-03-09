import javafx.application.Application;
import javafx.animation.AnimationTimer;
import javafx.scene.Scene;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;
import javafx.stage.Stage;
import javafx.geometry.VPos;

import java.util.*;

/**
 * RacingGame.java (Base Version)
 *
 * This is a compiling, runnable JavaFX top-down racing game foundation.
 * Next commits will expand this file step-by-step into the full 3000+ line Mega Racing Game.
 */
public class RacingGame extends Application {
    private static final int W = 1400;
    private static final int H = 900;

    private Canvas canvas;
    private GraphicsContext gc;
    private Game game;

    private final Set<KeyCode> keysDown = new HashSet<>();
    private Set<KeyCode> keysDownLast = new HashSet<>();

    @Override
    public void start(Stage stage) {
        canvas = new Canvas(W, H);
        gc = canvas.getGraphicsContext2D();

        game = new Game(canvas);

        StackPane root = new StackPane(canvas);
        Scene scene = new Scene(root, W, H);

        scene.setOnKeyPressed(e -> {
            keysDown.add(e.getCode());
            e.consume();
        });
        scene.setOnKeyReleased(e -> {
            keysDown.remove(e.getCode());
            e.consume();
        });

        stage.focusedProperty().addListener((obs, oldV, focused) -> {
            if (!focused) keysDown.clear();
        });

        AnimationTimer timer = new AnimationTimer() {
            @Override
            public void handle(long now) {
                Set<KeyCode> newKeys = new HashSet<>(keysDown);
                newKeys.removeAll(keysDownLast);
                game.update(keysDown, newKeys);
                game.render(gc);
                keysDownLast = new HashSet<>(keysDown);
            }
        };

        stage.setTitle("RacingGame (Base)");
        stage.setScene(scene);
        stage.setResizable(false);
        stage.setOnCloseRequest(e -> System.exit(0));
        stage.show();
        stage.requestFocus();
        timer.start();
    }

    public static void main(String[] args) {
        launch(args);
    }
}

// ═══════════════════════════════════════════════════════════════
//  Math / Utility
// ═══════════════════════════════════════════════════════════════
class Vec2 {
    public double x, y;
    public Vec2(double x, double y) { this.x = x; this.y = y; }
    public Vec2 add(Vec2 o) { return new Vec2(x + o.x, y + o.y); }
    public Vec2 sub(Vec2 o) { return new Vec2(x - o.x, y - o.y); }
    public Vec2 mul(double s) { return new Vec2(x * s, y * s); }
    public double len() { return Math.hypot(x, y); }
    public Vec2 norm() { double l = len(); return l == 0 ? new Vec2(0,0) : new Vec2(x/l, y/l); }
    public static Vec2 fromAngle(double a) { return new Vec2(Math.cos(a), Math.sin(a)); }
}

// ═══════════════════════════════════════════════════════════════
//  Track (single oval for base)
// ═══════════════════════════════════════════════════════════════
class Track {
    private final List<Vec2> points = new ArrayList<>();
    public final int width;

    public Track(int w) {
        this.width = w;
        double cx = 700, cy = 450;
        for (double a = -Math.PI / 2; a < Math.PI * 1.5; a += 0.02) {
            points.add(new Vec2(cx + Math.cos(a) * 400, cy + Math.sin(a) * 270));
        }
    }

    public int count() { return points.size(); }

    public Vec2 get(int idx) {
        int n = points.size();
        int i = ((idx % n) + n) % n;
        return points.get(i);
    }

    public int nearestIndex(double x, double y) {
        int best = 0;
        double bestD = Double.MAX_VALUE;
        for (int i = 0; i < points.size(); i++) {
            Vec2 p = points.get(i);
            double d = Math.hypot(p.x - x, p.y - y);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    public boolean onTrack(double x, double y) {
        int idx = nearestIndex(x, y);
        Vec2 p = get(idx);
        double d = Math.hypot(p.x - x, p.y - y);
        return d <= width / 2.0 + 20;
    }

    public void render(GraphicsContext gc, double camX, double camY, double sw, double sh) {
        // grass
        gc.setFill(Color.web("#113311"));
        gc.fillRect(0, 0, sw, sh);

        // curb
        gc.setStroke(Color.web("#cc0000"));
        gc.setLineWidth(width + 14);
        gc.beginPath();
        Vec2 p0 = points.get(0);
        gc.moveTo(p0.x - camX + sw/2, p0.y - camY + sh/2);
        for (int i = 1; i < points.size(); i++) {
            Vec2 p = points.get(i);
            gc.lineTo(p.x - camX + sw/2, p.y - camY + sh/2);
        }
        gc.closePath();
        gc.stroke();

        // tarmac
        gc.setStroke(Color.web("#333333"));
        gc.setLineWidth(width);
        gc.beginPath();
        gc.moveTo(p0.x - camX + sw/2, p0.y - camY + sh/2);
        for (int i = 1; i < points.size(); i++) {
            Vec2 p = points.get(i);
            gc.lineTo(p.x - camX + sw/2, p.y - camY + sh/2);
        }
        gc.closePath();
        gc.stroke();

        // center dash
        gc.setStroke(Color.web("#ffff0055"));
        gc.setLineWidth(2);
        gc.setLineDashes(16, 16);
        gc.beginPath();
        gc.moveTo(p0.x - camX + sw/2, p0.y - camY + sh/2);
        for (int i = 1; i < points.size(); i++) {
            Vec2 p = points.get(i);
            gc.lineTo(p.x - camX + sw/2, p.y - camY + sh/2);
        }
        gc.closePath();
        gc.stroke();
        gc.setLineDashes(0);
    }
}

// ═══════════════════════════════════════════════════════════════
//  Car
// ═══════════════════════════════════════════════════════════════
class Car {
    public double x, y, rot;
    public double speed;
    public Color color;
    public String name;

    public int lap = 0;
    public int trackIdx = 0;

    public Car(double x, double y, Color c, String name) {
        this.x = x; this.y = y; this.color = c; this.name = name;
    }

    public void render(GraphicsContext gc, double camX, double camY, double sw, double sh) {
        double sx = x - camX + sw/2;
        double sy = y - camY + sh/2;
        gc.save();
        gc.translate(sx, sy);
        gc.rotate(Math.toDegrees(rot));

        // shadow
        gc.setGlobalAlpha(0.25);
        gc.setFill(Color.BLACK);
        gc.fillRoundRect(-20 + 3, -32 + 3, 40, 64, 8, 8);
        gc.setGlobalAlpha(1.0);

        gc.setFill(color);
        gc.fillRoundRect(-20, -32, 40, 64, 8, 8);
        gc.setFill(Color.web("#aaddff88"));
        gc.fillRoundRect(-15, -22, 30, 16, 5, 5);

        gc.setFill(Color.web("#222222"));
        gc.fillRect(-24, -22, 7, 14);
        gc.fillRect(17, -22, 7, 14);
        gc.fillRect(-24, 8, 7, 14);
        gc.fillRect(17, 8, 7, 14);

        gc.restore();

        gc.setFont(Font.font("Arial", FontWeight.BOLD, 10));
        gc.setFill(Color.WHITE);
        gc.setGlobalAlpha(0.7);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.fillText(name, sx, sy - 40);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.setGlobalAlpha(1.0);
    }
}

// ═══════════════════════════════════════════════════════════════
//  Game
// ═══════════════════════════════════════════════════════════════
class Game {
    private final Canvas canvas;

    private String state = "menu"; // menu, playing, paused, finished
    private int menuSelection = 0;
    private final String[] menuItems = {"Quick Race", "Quit"};

    private Track track;
    private Car player;
    private final List<Car> enemies = new ArrayList<>();

    private double camX, camY;
    private long startTime;

    public Game(Canvas canvas) {
        this.canvas = canvas;
        this.track = new Track(210);
        resetRace();
    }

    private void resetRace() {
        Vec2 start = track.get(0);
        Vec2 next = track.get(10);
        double ang = Math.atan2(next.y - start.y, next.x - start.x);

        player = new Car(start.x, start.y + 60, Color.web("#ff0055"), "Player");
        player.rot = ang;

        enemies.clear();
        enemies.add(new Car(start.x - 50, start.y + 10, Color.web("#ff3333"), "Blaze"));
        enemies.add(new Car(start.x + 50, start.y + 10, Color.web("#ff8800"), "Turbo"));
        enemies.add(new Car(start.x, start.y - 40, Color.web("#00ccff"), "Frost"));
        for (Car e : enemies) e.rot = ang;

        camX = player.x;
        camY = player.y;
        startTime = System.currentTimeMillis();
    }

    public void update(Set<KeyCode> keys, Set<KeyCode> newKeys) {
        switch (state) {
            case "menu":
                if (newKeys.contains(KeyCode.UP)) menuSelection = (menuSelection - 1 + menuItems.length) % menuItems.length;
                if (newKeys.contains(KeyCode.DOWN)) menuSelection = (menuSelection + 1) % menuItems.length;
                if (newKeys.contains(KeyCode.ENTER) || newKeys.contains(KeyCode.SPACE)) {
                    if (menuSelection == 0) {
                        resetRace();
                        state = "playing";
                    } else {
                        System.exit(0);
                    }
                }
                break;

            case "playing":
                if (newKeys.contains(KeyCode.P)) { state = "paused"; break; }
                updatePlayer(keys);
                updateAI();
                camX += (player.x - camX) * 0.10;
                camY += (player.y - camY) * 0.10;
                break;

            case "paused":
                if (newKeys.contains(KeyCode.P)) state = "playing";
                if (newKeys.contains(KeyCode.Q)) state = "menu";
                break;

            case "finished":
                if (newKeys.contains(KeyCode.ENTER) || newKeys.contains(KeyCode.SPACE)) state = "menu";
                break;
        }
    }

    private void updatePlayer(Set<KeyCode> keys) {
        boolean accel = keys.contains(KeyCode.W) || keys.contains(KeyCode.UP);
        boolean brake = keys.contains(KeyCode.S) || keys.contains(KeyCode.DOWN);
        double turn = 0;
        if (keys.contains(KeyCode.A) || keys.contains(KeyCode.LEFT)) turn -= 1;
        if (keys.contains(KeyCode.D) || keys.contains(KeyCode.RIGHT)) turn += 1;

        if (accel) player.speed = Math.min(player.speed + 0.35, 18);
        else if (brake) player.speed = Math.max(player.speed - 0.45, -4);
        else player.speed *= 0.93;

        double speedFact = Math.min(1.0, Math.abs(player.speed) / 10.0);
        player.rot += turn * 0.075 * speedFact;

        player.x += Math.cos(player.rot) * player.speed;
        player.y += Math.sin(player.rot) * player.speed;

        // off-track friction
        if (!track.onTrack(player.x, player.y)) player.speed *= 0.75;

        // progress
        player.trackIdx = track.nearestIndex(player.x, player.y);

        // finish after some time (base)
        if (System.currentTimeMillis() - startTime > 60_000) {
            state = "finished";
        }
    }

    private void updateAI() {
        for (Car ai : enemies) {
            ai.trackIdx = track.nearestIndex(ai.x, ai.y);
            int target = (ai.trackIdx + 14) % track.count();
            Vec2 t = track.get(target);
            double dx = t.x - ai.x;
            double dy = t.y - ai.y;
            double targRot = Math.atan2(dy, dx);
            double diff = targRot - ai.rot;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ai.rot += diff * 0.08;
            ai.speed = Math.min(ai.speed + 0.20, 15);
            ai.x += Math.cos(ai.rot) * ai.speed;
            ai.y += Math.sin(ai.rot) * ai.speed;
            if (!track.onTrack(ai.x, ai.y)) ai.speed *= 0.75;
        }
    }

    public void render(GraphicsContext gc) {
        double w = canvas.getWidth();
        double h = canvas.getHeight();

        if (state.equals("menu")) {
            renderMenu(gc, w, h);
            return;
        }

        // world
        track.render(gc, camX, camY, w, h);
        for (Car ai : enemies) ai.render(gc, camX, camY, w, h);
        player.render(gc, camX, camY, w, h);

        // HUD
        renderHUD(gc, w, h);

        if (state.equals("paused")) renderPaused(gc, w, h);
        if (state.equals("finished")) renderFinished(gc, w, h);
    }

    private void renderMenu(GraphicsContext gc, double w, double h) {
        gc.setFill(Color.web("#0a0a1a"));
        gc.fillRect(0, 0, w, h);

        gc.setFont(Font.font("Arial", FontWeight.BOLD, 72));
        gc.setFill(Color.web("#ff0055"));
        gc.setTextAlign(TextAlignment.CENTER);
        gc.fillText("RACING GAME", w/2, h * 0.25);

        gc.setFont(Font.font("Arial", 16));
        gc.setFill(Color.web("#ffaa00"));
        gc.fillText("Base version (will be expanded)", w/2, h * 0.31);

        for (int i = 0; i < menuItems.length; i++) {
            boolean sel = i == menuSelection;
            double y = h * 0.48 + i * 60;
            gc.setFill(sel ? Color.web("#ff005533") : Color.web("#00000088"));
            gc.fillRoundRect(w/2 - 160, y - 22, 320, 44, 10, 10);
            gc.setStroke(sel ? Color.web("#ff0055") : Color.web("#333333"));
            gc.setLineWidth(sel ? 2 : 1);
            gc.strokeRoundRect(w/2 - 160, y - 22, 320, 44, 10, 10);

            gc.setFont(Font.font("Arial", FontWeight.BOLD, sel ? 22 : 18));
            gc.setFill(sel ? Color.WHITE : Color.web("#888888"));
            gc.setTextBaseline(VPos.CENTER);
            gc.fillText(menuItems[i], w/2, y);
        }
        gc.setTextBaseline(VPos.BASELINE);
        gc.setTextAlign(TextAlignment.LEFT);

        gc.setFont(Font.font("Arial", 12));
        gc.setFill(Color.web("#666666"));
        gc.setTextAlign(TextAlignment.CENTER);
        gc.fillText("UP/DOWN + ENTER | In race: WASD/Arrows, P pause", w/2, h * 0.95);
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void renderHUD(GraphicsContext gc, double w, double h) {
        gc.setFill(Color.web("#000000cc"));
        gc.fillRoundRect(15, 15, 260, 110, 10, 10);
        gc.setStroke(Color.web("#ff0055"));
        gc.setLineWidth(2);
        gc.strokeRoundRect(15, 15, 260, 110, 10, 10);

        gc.setFont(Font.font("Arial", FontWeight.BOLD, 12));
        gc.setFill(Color.web("#ff0055"));
        gc.fillText("VEHICLE", 28, 36);

        gc.setFont(Font.font("Arial", 13));
        gc.setFill(Color.web("#ffaa00"));
        gc.fillText("Speed: " + Math.round(Math.abs(player.speed) * 10) + " km/h", 28, 60);
        gc.fillText("Pos:   " + player.trackIdx, 28, 80);
        gc.fillText("State: " + state, 28, 100);

        long t = System.currentTimeMillis() - startTime;
        gc.setFill(Color.web("#000000cc"));
        gc.fillRoundRect(w - 275, 15, 260, 80, 10, 10);
        gc.setStroke(Color.web("#ff0055"));
        gc.setLineWidth(2);
        gc.strokeRoundRect(w - 275, 15, 260, 80, 10, 10);

        gc.setFont(Font.font("Arial", FontWeight.BOLD, 12));
        gc.setFill(Color.web("#ff0055"));
        gc.fillText("RACE", w - 262, 36);

        gc.setFont(Font.font("Arial", 13));
        gc.setFill(Color.web("#ffaa00"));
        gc.fillText("Time: " + (t/1000) + "s", w - 262, 60);
        gc.fillText("P: Pause | Q: Menu", w - 262, 80);
    }

    private void renderPaused(GraphicsContext gc, double w, double h) {
        gc.setFill(Color.web("#000000aa"));
        gc.fillRect(0, 0, w, h);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setTextBaseline(VPos.CENTER);
        gc.setFont(Font.font("Arial", FontWeight.BOLD, 64));
        gc.setFill(Color.web("#ffff00"));
        gc.fillText("PAUSED", w/2, h/2);
        gc.setFont(Font.font("Arial", 18));
        gc.setFill(Color.web("#ffaa00"));
        gc.fillText("Press P to resume | Q to menu", w/2, h/2 + 60);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.setTextBaseline(VPos.BASELINE);
    }

    private void renderFinished(GraphicsContext gc, double w, double h) {
        gc.setFill(Color.web("#000000cc"));
        gc.fillRect(0, 0, w, h);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setTextBaseline(VPos.CENTER);
        gc.setFont(Font.font("Arial", FontWeight.BOLD, 56));
        gc.setFill(Color.web("#00ff88"));
        gc.fillText("FINISH (Base)", w/2, h/2 - 20);
        gc.setFont(Font.font("Arial", 18));
        gc.setFill(Color.web("#ffaa00"));
        gc.fillText("Press ENTER to return to menu", w/2, h/2 + 50);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.setTextBaseline(VPos.BASELINE);
    }
}