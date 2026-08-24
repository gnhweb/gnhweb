package app.gnhweb.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.provider.Settings;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://gnhweb.vercel.app/";
    private WebView webView;
    private boolean authenticated = false;
    private boolean promptShowing = false;
    private boolean webReady = false;
    private final Executor executor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showLockScreen();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (authenticated && !promptShowing) showBiometricPrompt();
    }

    private void showLockScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setBackgroundColor(android.graphics.Color.rgb(11, 13, 18));
        root.setPadding(48, 48, 48, 48);

        TextView title = new TextView(this);
        title.setText("강릉 학생회");
        title.setTextColor(android.graphics.Color.WHITE);
        title.setTextSize(24);
        title.setGravity(android.view.Gravity.CENTER);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView message = new TextView(this);
        message.setText("지문 또는 Face ID로 잠금 해제합니다.");
        message.setTextColor(android.graphics.Color.LTGRAY);
        message.setTextSize(15);
        message.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(-1, -2);
        messageParams.topMargin = 24;
        root.addView(message, messageParams);

        Button retry = new Button(this);
        retry.setText("생체인증 다시 시도");
        retry.setOnClickListener(v -> showBiometricPrompt());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1, -2);
        buttonParams.topMargin = 28;
        root.addView(retry, buttonParams);

        setContentView(root);
        showBiometricPrompt();
    }

    private void showBiometricPrompt() {
        if (promptShowing) return;
        promptShowing = true;

        try {
            BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("강릉 학생회")
                    .setSubtitle("지문 또는 Face ID로 잠금 해제")
                    .setDescription("등록된 기기 생체인증을 사용합니다.")
                    .setNegativeButton("취소", executor, (dialogInterface, which) -> promptShowing = false)
                    .build();

            CancellationSignal cancellationSignal = new CancellationSignal();
            prompt.authenticate(cancellationSignal, executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    runOnUiThread(() -> {
                        promptShowing = false;
                        authenticated = true;
                        showWebApp();
                    });
                }

                @Override
                public void onAuthenticationFailed() {
                    // Keep the Android prompt available for another attempt.
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    runOnUiThread(() -> {
                        promptShowing = false;
                        if (errorCode != BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
                                && errorCode != BiometricPrompt.BIOMETRIC_ERROR_CANCELED
                                && errorCode != BiometricPrompt.BIOMETRIC_ERROR_NEGATIVE_BUTTON) {
                            showBiometricUnavailableDialog(errString == null ? "생체인증을 사용할 수 없습니다." : errString.toString());
                        }
                    });
                }
            });
        } catch (Exception e) {
            promptShowing = false;
            showBiometricUnavailableDialog("이 기기의 생체인증을 시작할 수 없습니다.");
        }
    }

    private void showBiometricUnavailableDialog(String message) {
        new AlertDialog.Builder(this)
                .setTitle("생체인증 필요")
                .setMessage(message + "\n\n휴대폰 설정에서 지문 또는 Face ID를 먼저 등록해주세요.")
                .setNegativeButton("닫기", null)
                .setPositiveButton("설정 열기", (dialog, which) -> {
                    try {
                        startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                    } catch (Exception ignored) {}
                })
                .show();
    }

    private void showWebApp() {
        if (webReady && webView != null) {
            webView.setVisibility(View.VISIBLE);
            return;
        }

        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(11, 13, 18));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme == null) return false;
                if (scheme.equals("http") || scheme.equals("https")) return false;

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

        String userAgent = webView.getSettings().getUserAgentString();
        webView.getSettings().setUserAgentString(userAgent + " GNHWebAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        setContentView(webView);
        webReady = true;
        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (authenticated && !promptShowing) {
            if (webView != null) webView.setVisibility(View.INVISIBLE);
            authenticated = false;
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        executor.shutdownNow();
        super.onDestroy();
    }
}
