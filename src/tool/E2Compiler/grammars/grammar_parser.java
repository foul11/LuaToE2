import com.google.gson.*;
import org.antlr.v4.runtime.tree.*;
import org.antlr.v4.runtime.*;
import java.util.*;


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
    
    public static void main(String[] args) throws Exception {
        ANTLRInputStream in = new ANTLRInputStream(System.in);
        E2Lexer lexer = new E2Lexer(in);
        
        CommonTokenStream tokens = new CommonTokenStream(lexer);
        E2Parser parser = new E2Parser(tokens);
        
        System.out.println(toJson(parser.root(), false));
        // System.out.println(printSyntaxTree(parser, parser.root()));
    }
}