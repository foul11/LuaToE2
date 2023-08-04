import com.google.gson.*;
import org.antlr.v4.runtime.tree.*;
import org.antlr.v4.runtime.*;

import java.nio.charset.StandardCharsets;
import java.util.*;
import dist.E2Lexer;
import dist.E2Parser;

// final class ThrowingErrorListener extends BaseErrorListener {

//     public static final ThrowingErrorListener INSTANCE = new ThrowingErrorListener();

//     @Override
//     public void syntaxError(Recognizer<?, ?> recognizer, Object offendingSymbol, int line, int charPositionInLine,
//             String msg, RecognitionException e) {
//                 System.err.print(msg);
//                 System.exit(1);
//     }
// }

public class grammar_parser {
    private static final Gson PRETTY_PRINT_GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Gson GSON = new Gson();

    public static String toJson(ParseTree tree) {
        return toJson(tree, true);
    }

    public static String toJson(ParseTree tree, boolean prettyPrint) {
        return prettyPrint ? PRETTY_PRINT_GSON.toJson(toMap(tree)) : GSON.toJson(toMap(tree));
    }

    public static Map<String, Object> toMap(ParseTree tree) {
        Map<String, Object> map = new LinkedHashMap<>();
        traverse(tree, map);

        return map;
    }

    public static void traverse(ParseTree tree, Map<String, Object> map) {
        if (tree instanceof TerminalNodeImpl) {
            Token token = ((TerminalNodeImpl) tree).getSymbol();

            map.put("type", token.getType());
            map.put("text", token.getText());
            map.put("line", token.getLine());
        } else {
            List<Map<String, Object>> children = new ArrayList<>();
            String name = tree.getClass().getSimpleName().replaceAll("Context$", "");

            map.put(Character.toLowerCase(name.charAt(0)) + name.substring(1), children);

            for (int i = 0; i < tree.getChildCount(); i++) {
                Map<String, Object> nested = new LinkedHashMap<>();
                children.add(nested);
                traverse(tree.getChild(i), nested);
            }
        }
    }

    public static String printSyntaxTree(Parser parser, ParseTree root) {
        StringBuilder buf = new StringBuilder();
        recursive(root, buf, 0, Arrays.asList(parser.getRuleNames()));
        return buf.toString();
    }

    private static void recursive(ParseTree aRoot, StringBuilder buf, int offset, List<String> ruleNames) {
        for (int i = 0; i < offset; i++) {
            buf.append("  ");
        }
        buf.append(Trees.getNodeText(aRoot, ruleNames)).append("\n");
        if (aRoot instanceof ParserRuleContext) {
            ParserRuleContext prc = (ParserRuleContext) aRoot;
            if (prc.children != null) {
                for (ParseTree child : prc.children) {
                    recursive(child, buf, offset + 1, ruleNames);
                }
            }
        }
    }

    private static int toInt(byte[] bytes) {
        int value = 0;

        for (byte b : bytes) {
            value = (value << 8) + (b & 0xFF);
        }

        return value;
    }

    private static byte[] toBytes(int value) {
        byte[] bytes = new byte[Integer.BYTES];
        int length = bytes.length;

        for (int i = 0; i < length; i++) {
            bytes[length - i - 1] = (byte) (value & 0xFF);
            value >>= 8;
        }

        return bytes;
    }

    public static void main(String[] args) throws Exception {
        while (true) {
            byte[] size = new byte[4];

            if (System.in.readNBytes(size, 0, size.length) == -1) {
                throw new Error("stdin dead");
            }

            byte[] buff = new byte[toInt(size)];

            if (System.in.readNBytes(buff, 0, buff.length) == -1) {
                throw new Error("stdin dead");
            }
            
            String source = new String(buff); // StandardCharsets.UTF_8 -- error chars
            CharStream in = CharStreams.fromString(source);
            // ANTLRInputStream in = new ANTLRInputStream(System.in);
            E2Lexer lexer = new E2Lexer(in);

            CommonTokenStream tokens = new CommonTokenStream(lexer);
            E2Parser parser = new E2Parser(tokens);

            String json = toJson(parser.root(), false);

            System.out.write(toBytes(json.length()));
            System.out.write(json.getBytes());
        }
    }
}