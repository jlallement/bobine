package fr.bobine.pastilles;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.animation.OvershootInterpolator;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public class MainActivity extends Activity {
    private static final int[] PALETTE = {
        0xFFE53935, 0xFF43A047, 0xFF1E88E5, 0xFFFB8C00, 0xFF8E24AA, 0xFFD81B60, 0xFF00897B, 0xFF3949AB
    };

    private final Random random = new Random();
    private final List<Integer> couleurs = new ArrayList<>();
    private GridLayout grille;
    private TextView compteur;
    private int total = 3;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout racine = new LinearLayout(this);
        racine.setOrientation(LinearLayout.VERTICAL);
        racine.setGravity(Gravity.CENTER_HORIZONTAL);
        racine.setBackgroundColor(Color.WHITE);
        int marge = dp(32);
        racine.setOnApplyWindowInsetsListener((vue, encarts) -> {
            Insets barres = encarts.getInsets(WindowInsets.Type.systemBars());
            vue.setPadding(marge + barres.left, marge + barres.top, marge + barres.right, marge + barres.bottom);
            return encarts;
        });

        TextView titre = new TextView(this);
        titre.setText("Pastilles");
        titre.setTextSize(34);
        titre.setTypeface(Typeface.DEFAULT_BOLD);
        titre.setTextColor(Color.BLACK);
        titre.setGravity(Gravity.CENTER);
        racine.addView(titre);

        compteur = new TextView(this);
        compteur.setText(total + " pastilles");
        compteur.setTextSize(20);
        compteur.setTextColor(Color.GRAY);
        compteur.setGravity(Gravity.CENTER);
        compteur.setPadding(0, dp(8), 0, dp(24));
        racine.addView(compteur);

        grille = new GridLayout(this);
        grille.setColumnCount(4);
        racine.addView(grille, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        ajouter(PALETTE[0], false);
        ajouter(PALETTE[1], false);
        ajouter(PALETTE[2], false);

        View espace = new View(this);
        racine.addView(espace, new LinearLayout.LayoutParams(0, 0, 1f));

        LinearLayout boutons = new LinearLayout(this);
        boutons.setGravity(Gravity.CENTER);
        Button ajouter = bouton("Ajouter", 0xFF1E88E5);
        ajouter.setOnClickListener(v -> ajouter(PALETTE[random.nextInt(PALETTE.length)], true));
        Button melanger = bouton("Mélanger", 0xFFFFD60A);
        melanger.setOnClickListener(v -> melanger());
        boutons.addView(ajouter);
        boutons.addView(melanger);
        racine.addView(boutons);

        setContentView(racine);
    }

    private void ajouter(int couleur, boolean anime) {
        couleurs.add(couleur);
        View pastille = new View(this);
        pastille.setBackground(rond(couleur));
        GridLayout.LayoutParams place = new GridLayout.LayoutParams();
        place.width = dp(56);
        place.height = dp(56);
        place.setMargins(dp(4), dp(4), dp(4), dp(4));
        grille.addView(pastille, place);
        if (anime) {
            pastille.setScaleX(0f);
            pastille.setScaleY(0f);
            pastille.animate().scaleX(1f).scaleY(1f).setDuration(600)
                .setInterpolator(new OvershootInterpolator()).start();
        }
    }

    private void melanger() {
        Collections.shuffle(couleurs, random);
        for (int i = 0; i < grille.getChildCount(); i++) {
            View pastille = grille.getChildAt(i);
            int couleur = couleurs.get(i);
            pastille.animate().alpha(0f).setDuration(300).withEndAction(() -> {
                pastille.setBackground(rond(couleur));
                pastille.animate().alpha(1f).setDuration(300).start();
            }).start();
        }
    }

    private Button bouton(String texte, int fond) {
        Button bouton = new Button(this);
        bouton.setText(texte);
        bouton.setAllCaps(false);
        bouton.setTextSize(18);
        bouton.setTextColor(Color.WHITE);
        GradientDrawable forme = new GradientDrawable();
        forme.setColor(fond);
        forme.setCornerRadius(dp(24));
        bouton.setBackground(forme);
        bouton.setPadding(dp(24), 0, dp(24), 0);
        LinearLayout.LayoutParams place = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(52));
        place.setMargins(dp(8), 0, dp(8), 0);
        bouton.setLayoutParams(place);
        return bouton;
    }

    private static GradientDrawable rond(int couleur) {
        GradientDrawable forme = new GradientDrawable();
        forme.setShape(GradientDrawable.OVAL);
        forme.setColor(couleur);
        return forme;
    }

    private int dp(int valeur) {
        return Math.round(valeur * getResources().getDisplayMetrics().density);
    }
}
